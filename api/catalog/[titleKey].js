import { verifyAuth } from "../_lib/authMiddleware.js";
import { handleApiError } from "../_lib/errorHandler.js";
import { getMediaDetails } from "../_lib/services/catalogService.js";
import { sendError } from "../_lib/utils.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendError(res, 405, "method-not-allowed", "Only GET is allowed");
  }

  try {
    let userId = null;
    try {
      const decodedToken = await verifyAuth(req);
      userId = decodedToken.uid;
    } catch {
      // Allow unauthenticated fetch, but state/progress will be null
    }

    const { titleKey } = req.query;
    const result = await getMediaDetails(userId, titleKey);

    return res.status(200).json(result);
  } catch (err) {
    return handleApiError(res, err);
  }
}
