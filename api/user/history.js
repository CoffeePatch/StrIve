import { verifyAuth } from "../_lib/authMiddleware.js";
import { handleApiError } from "../_lib/errorHandler.js";
import { getUserWatchHistory } from "../_lib/services/userService.js";
import { sendError } from "../_lib/utils.js";

export default async function handler(req, res) {
  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;

    if (req.method !== "GET") {
      return sendError(res, 405, "method-not-allowed", "Only GET is allowed");
    }

    const { limit, offset } = req.query || {};
    const historyData = await getUserWatchHistory(userId, { limit, offset });

    return res.status(200).json(historyData);
  } catch (err) {
    return handleApiError(res, err);
  }
}
