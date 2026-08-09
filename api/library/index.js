import { verifyAuth } from "../_lib/authMiddleware.js";
import { handleApiError } from "../_lib/errorHandler.js";
import { getLibrary } from "../_lib/services/libraryService.js";
import { sendError } from "../_lib/utils.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendError(res, 405, "method-not-allowed", "Only GET is allowed");
  }

  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;
    
    // Extract options from query
    const options = {
      status: req.query.status,
      cursor: req.query.cursor,
      limit: req.query.limit
    };

    const result = await getLibrary(userId, options);
    return res.status(200).json(result);
  } catch (err) {
    return handleApiError(res, err);
  }
}
