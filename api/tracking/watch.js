import { verifyAuth } from "../_lib/authMiddleware.js";
import { handleApiError } from "../_lib/errorHandler.js";
import { updateWatchState } from "../_lib/services/trackingService.js";
import { sendError } from "../_lib/utils.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendError(res, 405, "method-not-allowed", "Only POST is allowed");
  }

  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;
    
    // Pass the entire req.body to the tracking service
    // e.g. { titleKey: "...", mode: "single|season|unwatch", seasonNumber: 1, episodeNumber: 1 }
    const payload = req.body || {};
    
    const result = await updateWatchState(userId, payload);
    return res.status(200).json(result);
  } catch (err) {
    return handleApiError(res, err);
  }
}
