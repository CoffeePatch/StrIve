import { verifyAuth } from "../../_lib/authMiddleware.js";
import { sendError } from "../../_lib/utils.js";
import { confirmImportBatch } from "../../_lib/services/importConfirmService.js";
import { BackupValidationError } from "../../_lib/services/importValidator.js";

const MAX_PAYLOAD_BYTES = 4.0 * 1024 * 1024; // 4.0 MB upload size guard

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendError(res, 405, "method-not-allowed", "Only POST requests are allowed");
  }

  let user;
  try {
    user = await verifyAuth(req);
  } catch (error) {
    return sendError(res, 401, "unauthenticated", error?.message || "Authentication required");
  }

  try {
    let rawBody = req.body;
    let payloadString = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody || {});

    const byteSize = Buffer.byteLength(payloadString, "utf8");
    if (byteSize > MAX_PAYLOAD_BYTES) {
      console.error(`Confirm batch size ${byteSize} bytes exceeds platform limit of ${MAX_PAYLOAD_BYTES} bytes`);
      return sendError(res, 413, "payload-too-large", "Import batch payload exceeds 4.0 MB limit");
    }

    const bodyObj = typeof rawBody === "object" && rawBody !== null ? rawBody : JSON.parse(payloadString);
    const batchPayload = bodyObj.batchPayload || bodyObj.itemsChunk ? bodyObj : (bodyObj.payload || bodyObj);
    const conflictStrategy = bodyObj.conflictStrategy || req.query?.conflictStrategy || "MERGE";

    if (!batchPayload || typeof batchPayload !== "object") {
      return sendError(res, 400, "invalid-argument", "Missing batchPayload in request body");
    }

    const result = await confirmImportBatch({
      userId: user.uid,
      batchPayload,
      conflictStrategy,
    });

    return res.status(200).json(result);
  } catch (err) {
    if (err instanceof BackupValidationError) {
      return res.status(err.statusCode || 400).json({
        error: {
          code: err.code || "invalid-import-batch",
          message: err.message,
          details: err.details || null,
        },
      });
    }

    if (err instanceof SyntaxError) {
      return sendError(res, 400, "malformed-json", `JSON Syntax Error: ${err.message}`);
    }

    console.error("Error in /api/user/import/confirm:", err);
    return sendError(res, 500, "internal", "Failed to process import batch restoration");
  }
}
