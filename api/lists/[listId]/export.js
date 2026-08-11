import { verifyAuth } from "../../../_lib/authMiddleware.js";
import { sendError } from "../../../_lib/utils.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendError(res, 405, "method-not-allowed", "Method not allowed");
  }

  try {
    await verifyAuth(req);
    return res.status(501).json({
      success: false,
      code: "deferred_to_stage_2",
      message: "CSV List Export is being updated for PostgreSQL architecture (scheduled for Stage 2).",
    });
  } catch (error) {
    return sendError(res, 401, "unauthenticated", error.message);
  }
}
