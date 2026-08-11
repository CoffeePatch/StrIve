import { verifyAuth } from "../_lib/authMiddleware.js";
import { handleApiError } from "../_lib/errorHandler.js";
import { batchProcessLibraryItems } from "../_lib/services/libraryService.js";
import { sendError } from "../_lib/utils.js";

export default async function handler(req, res) {
  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;

    if (req.method === "POST") {
      const { titleKeys, action, status } = req.body || {};
      await batchProcessLibraryItems(userId, action, titleKeys, status);
      return res.status(200).json({ success: true });
    }

    return sendError(res, 405, "method-not-allowed", "Only POST is allowed");
  } catch (err) {
    return handleApiError(res, err);
  }
}
