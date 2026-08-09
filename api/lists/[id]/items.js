import { verifyAuth } from "../../../_lib/authMiddleware.js";
import { handleApiError } from "../../../_lib/errorHandler.js";
import { addItemsToList, removeItemsFromList } from "../../../_lib/services/listService.js";
import { sendError } from "../../../_lib/utils.js";

export default async function handler(req, res) {
  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;
    const listId = req.query.id;

    if (!listId) {
      return sendError(res, 400, "missing-list-id", "List ID is required");
    }

    if (req.method === "POST") {
      const { titleKeys } = req.body || {};
      const count = await addItemsToList(userId, listId, titleKeys);
      return res.status(200).json({ success: true, count });
    }
    
    if (req.method === "DELETE") {
      const { titleKeys } = req.body || {};
      const count = await removeItemsFromList(userId, listId, titleKeys);
      return res.status(200).json({ success: true, count });
    }

    return sendError(res, 405, "method-not-allowed", "Only POST and DELETE are allowed");
  } catch (err) {
    return handleApiError(res, err);
  }
}
