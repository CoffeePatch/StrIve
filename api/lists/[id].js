import { verifyAuth } from "../_lib/authMiddleware.js";
import { handleApiError } from "../_lib/errorHandler.js";
import { getListItems, updateList, deleteList } from "../_lib/services/listService.js";
import { sendError } from "../_lib/utils.js";

export default async function handler(req, res) {
  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;
    const listId = req.query.id;

    if (!listId) {
      return sendError(res, 400, "missing-list-id", "List ID is required");
    }

    if (req.method === "GET") {
      const options = {
        offset: req.query.offset,
        limit: req.query.limit
      };
      const result = await getListItems(userId, listId, options);
      return res.status(200).json(result);
    }
    
    if (req.method === "PATCH") {
      const { name, description, isPinned } = req.body || {};
      const updatedList = await updateList(userId, listId, { name, description, isPinned });
      return res.status(200).json(updatedList);
    }
    
    if (req.method === "DELETE") {
      await deleteList(userId, listId);
      return res.status(200).json({ success: true });
    }

    return sendError(res, 405, "method-not-allowed", "Only GET, PATCH, and DELETE are allowed");
  } catch (err) {
    return handleApiError(res, err);
  }
}
