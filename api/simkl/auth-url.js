import { verifyAuth } from "../_lib/authMiddleware.js";
import { handleApiError } from "../_lib/errorHandler.js";
import { generateOAuthState } from "../_lib/security/tokenCipher.js";
import { sendError } from "../_lib/utils.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendError(res, 405, "method-not-allowed", "Only GET is allowed");
  }

  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;

    const clientId = process.env.SIMKL_CLIENT_ID || process.env.VITE_SIMKL_CLIENT_ID;
    const redirectUri = process.env.SIMKL_REDIRECT_URI || process.env.VITE_SIMKL_REDIRECT_URI || `${req.headers.origin || "http://localhost:5173"}/simkl/callback`;

    if (!clientId) {
      return sendError(res, 500, "configuration-error", "SIMKL_CLIENT_ID is missing");
    }

    const state = generateOAuthState(userId);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      state,
    });

    const authUrl = `https://simkl.com/oauth/authorize?${params.toString()}`;

    return res.status(200).json({
      authUrl,
      state,
    });
  } catch (err) {
    return handleApiError(res, err);
  }
}
