import { verifyAuth } from "../_lib/authMiddleware.js";
import { handleApiError } from "../_lib/errorHandler.js";
import { updateLibraryStatus, deleteLibraryItem } from "../_lib/services/libraryService.js";
import { sendError } from "../_lib/utils.js";

export default async function handler(req, res) {
  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;
    const { titleKey } = req.query;

    if (!titleKey) {
      return sendError(res, 400, "missing-title-key", "Title key is required");
    }

    if (req.method === "PATCH") {
      const { status, userRating, notes } = req.body || {};
      const options = {};
      if (userRating !== undefined) options.userRating = userRating;
      if (notes !== undefined) options.notes = notes;
      await updateLibraryStatus(userId, titleKey, status, options);
      return res.status(200).json({ success: true });
    } 
    
    if (req.method === "DELETE") {
      await deleteLibraryItem(userId, titleKey);
      return res.status(200).json({ success: true });
    }

    return sendError(res, 405, "method-not-allowed", "Only PATCH and DELETE are allowed");
  } catch (err) {
    return handleApiError(res, err);
  }
}
