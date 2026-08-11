import { verifyAuth } from "../../_lib/authMiddleware.js";
import { handleApiError } from "../../_lib/errorHandler.js";
import { reorderListItem } from "../../_lib/services/listService.js";
import { sendError } from "../../_lib/utils.js";

export default async function handler(req, res) {
  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;
    const listId = req.query.id;

    if (!listId) {
      return sendError(res, 400, "missing-list-id", "List ID is required");
    }

    if (req.method !== "PATCH" && req.method !== "POST") {
      return sendError(res, 405, "method-not-allowed", "Only PATCH or POST are allowed");
    }

    const { titleKey, beforeTitleKey, afterTitleKey } = req.body || {};
    if (!titleKey) {
      return sendError(res, 400, "missing-title-key", "titleKey is required");
    }

    const result = await reorderListItem(userId, listId, {
      titleKey,
      beforeTitleKey,
      afterTitleKey
    });

    return res.status(200).json(result);
  } catch (err) {
    return handleApiError(res, err);
  }
}
