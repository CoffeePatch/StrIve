import { verifyAuth } from "../_lib/authMiddleware.js";
import { handleApiError } from "../_lib/errorHandler.js";
import { getUserLists, createList } from "../_lib/services/listService.js";
import { sendError } from "../_lib/utils.js";

export default async function handler(req, res) {
  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;

    if (req.method === "GET") {
      const lists = await getUserLists(userId);
      return res.status(200).json(lists);
    } 
    
    if (req.method === "POST") {
      const { name, description } = req.body || {};
      const newList = await createList(userId, { name, description });
      return res.status(201).json(newList);
    }

    return sendError(res, 405, "method-not-allowed", "Only GET and POST are allowed");
  } catch (err) {
    return handleApiError(res, err);
  }
}
