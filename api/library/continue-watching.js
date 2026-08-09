import { verifyAuth } from "../_lib/authMiddleware.js";
import { handleApiError } from "../_lib/errorHandler.js";
import { getContinueWatching } from "../_lib/services/libraryService.js";
import { sendError } from "../_lib/utils.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendError(res, 405, "method-not-allowed", "Only GET is allowed");
  }

  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;
    
    const options = {
      limit: req.query.limit
    };

    const result = await getContinueWatching(userId, options);
    return res.status(200).json({ items: result });
  } catch (err) {
    return handleApiError(res, err);
  }
}
