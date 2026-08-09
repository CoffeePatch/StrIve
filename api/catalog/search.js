import { verifyAuth } from "../_lib/authMiddleware.js";
import { handleApiError } from "../_lib/errorHandler.js";
import { searchCatalog } from "../_lib/services/catalogService.js";
import { sendError } from "../_lib/utils.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendError(res, 405, "method-not-allowed", "Only GET is allowed");
  }

  try {
    let userId = null;
    // Authentication is optional for catalog search if user is not logged in,
    // but the app usually requires login. We'll try to verify, but if it fails,
    // we just don't pass userId to the service (which turns off `inLibrary` check).
    try {
      const decodedToken = await verifyAuth(req);
      userId = decodedToken.uid;
    } catch {
      // Allow unauthenticated search but without inLibrary
    }
    
    const query = req.query.q;
    const options = {
      limit: req.query.limit
    };

    const results = await searchCatalog(userId, query, options);
    return res.status(200).json({ results });
  } catch (err) {
    return handleApiError(res, err);
  }
}
