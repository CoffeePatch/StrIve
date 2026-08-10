import prisma from "../_lib/prisma.js";
import { verifyAuth } from "../_lib/authMiddleware.js";
import { handleApiError } from "../_lib/errorHandler.js";
import { decryptToken } from "../_lib/security/tokenCipher.js";
import { sendError } from "../_lib/utils.js";

const MAX_BATCH_SIZE = 100;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendError(res, 405, "method-not-allowed", "Only POST is allowed");
  }

  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { simklToken: true },
    });

    if (!user || !user.simklToken) {
      return sendError(res, 401, "simkl-not-connected", "Simkl account is not connected. Please connect your Simkl account in Settings.");
    }

    const accessToken = decryptToken(user.simklToken);
    if (!accessToken) {
      return sendError(res, 401, "token-invalid", "Stored Simkl authentication token is invalid or corrupted. Please reconnect Simkl.");
    }

    const { action = "history", payload } = req.body || {};

    if (!payload || (typeof payload !== "object")) {
      return sendError(res, 400, "invalid-payload", "Sync payload is required");
    }

    const moviesCount = Array.isArray(payload.movies) ? payload.movies.length : 0;
    const showsCount = Array.isArray(payload.shows) ? payload.shows.length : 0;
    const episodesCount = Array.isArray(payload.episodes) ? payload.episodes.length : 0;
    const totalItems = moviesCount + showsCount + episodesCount;

    if (totalItems === 0) {
      return res.status(200).json({ success: true, processed: 0, skipped: 0 });
    }

    if (totalItems > MAX_BATCH_SIZE) {
      return sendError(res, 400, "batch-size-exceeded", `Batch size exceeds maximum limit of ${MAX_BATCH_SIZE} items`);
    }

    const clientId = process.env.SIMKL_CLIENT_ID || process.env.VITE_SIMKL_CLIENT_ID;
    if (!clientId) {
      return sendError(res, 500, "configuration-error", "SIMKL_CLIENT_ID is missing");
    }

    const targetEndpoint = action === "ratings" ? "https://api.simkl.com/sync/ratings" : "https://api.simkl.com/sync/history";

    const simklRes = await fetch(targetEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "simkl-api-key": clientId,
        "Authorization": `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    });

    if (!simklRes.ok) {
      if (simklRes.status === 429) {
        const retryAfter = simklRes.headers.get("retry-after") || "60";
        return sendError(res, 429, "rate-limited", `Simkl API rate limit reached. Please wait ${retryAfter} seconds.`, { retryAfter });
      }

      if (simklRes.status === 401 || simklRes.status === 403) {
        return sendError(res, 401, "auth-failed", "Simkl authorization expired or revoked. Please reconnect your account.");
      }

      const errData = await simklRes.json().catch(() => ({}));
      return sendError(res, simklRes.status || 500, "simkl-error", errData.message || "Simkl API request failed");
    }

    const resData = await simklRes.json();

    return res.status(200).json({
      success: true,
      processed: totalItems,
      added: resData.added || null,
      notFound: resData.not_found || null,
    });
  } catch (err) {
    return handleApiError(res, err);
  }
}
