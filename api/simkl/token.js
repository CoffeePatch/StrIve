import prisma from "../_lib/prisma.js";
import { verifyAuth } from "../_lib/authMiddleware.js";
import { handleApiError } from "../_lib/errorHandler.js";
import { encryptToken, verifyOAuthState } from "../_lib/security/tokenCipher.js";
import { sendError } from "../_lib/utils.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendError(res, 405, "method-not-allowed", "Only POST is allowed");
  }

  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;

    const { code, state, redirectUri } = req.body || {};

    if (!code) {
      return sendError(res, 400, "invalid-argument", "Authorization code is required");
    }

    if (state && !verifyOAuthState(state, userId)) {
      return sendError(res, 403, "invalid-state", "Invalid or expired OAuth state parameter");
    }

    const clientId = process.env.SIMKL_CLIENT_ID || process.env.VITE_SIMKL_CLIENT_ID;
    const clientSecret = process.env.SIMKL_CLIENT_SECRET;
    const redirect_uri = redirectUri || process.env.SIMKL_REDIRECT_URI || process.env.VITE_SIMKL_REDIRECT_URI || `${req.headers.origin || "http://localhost:5173"}/simkl/callback`;

    if (!clientSecret) {
      console.error("SIMKL_CLIENT_SECRET is missing from server environment variables");
      return sendError(res, 500, "configuration-error", "SIMKL authentication is unconfigured");
    }

    const simklRes = await fetch("https://api.simkl.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri,
        grant_type: "authorization_code",
      }),
    });

    if (!simklRes.ok) {
      const errorData = await simklRes.json().catch(() => ({}));
      return sendError(
        res,
        simklRes.status || 400,
        "oauth-failed",
        errorData.message || "Failed to exchange code for token"
      );
    }

    const data = await simklRes.json();
    const accessToken = data.access_token;

    if (!accessToken) {
      return sendError(res, 400, "token-missing", "No access token received from Simkl");
    }

    // Resolve Simkl user profile to store stable Simkl account ID
    let simklUserId = null;
    try {
      const profileRes = await fetch("https://api.simkl.com/users/settings", {
        headers: {
          "Content-Type": "application/json",
          "simkl-api-key": clientId,
          "Authorization": `Bearer ${accessToken}`,
        },
      });
      if (profileRes.ok) {
        const profile = await profileRes.json();
        simklUserId = String(profile?.user?.id || profile?.user?.name || profile?.account?.id || "");
      }
    } catch (err) {
      console.warn("Failed to fetch Simkl user profile:", err?.message || err);
    }

    const encryptedToken = encryptToken(accessToken);

    await prisma.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        simklToken: encryptedToken,
        simklUserId,
        simklConnectedAt: new Date(),
      },
      update: {
        simklToken: encryptedToken,
        simklUserId,
        simklConnectedAt: new Date(),
      },
    });

    return res.status(200).json({
      success: true,
      connected: true,
      simklUserId,
      connectedAt: new Date().toISOString(),
    });
  } catch (err) {
    return handleApiError(res, err);
  }
}
