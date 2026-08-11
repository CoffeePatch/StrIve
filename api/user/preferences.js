import { verifyAuth } from "../../_lib/authMiddleware.js";
import { handleApiError } from "../../_lib/errorHandler.js";
import { getUserPreferences, updateUserPreferences } from "../../_lib/services/userService.js";
import { sendError } from "../../_lib/utils.js";

export default async function handler(req, res) {
  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;

    if (req.method === "GET") {
      const prefs = await getUserPreferences(userId);
      return res.status(200).json(prefs);
    } 
    
    if (req.method === "PATCH") {
      const partialPrefs = req.body || {};
      const updatedPrefs = await updateUserPreferences(userId, partialPrefs);
      return res.status(200).json(updatedPrefs);
    }

    return sendError(res, 405, "method-not-allowed", "Only GET and PATCH are allowed");
  } catch (err) {
    return handleApiError(res, err);
  }
}
