import { verifyAuth } from "../../_lib/authMiddleware.js";
import { sendError } from "../../_lib/utils.js";
import { analyzeImportPayload } from "../../_lib/services/importAnalysisService.js";
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
    let rawPayload = req.body;
    if (typeof rawPayload === "object" && !Buffer.isBuffer(rawPayload)) {
      rawPayload = JSON.stringify(rawPayload);
    }

    const payloadString = typeof rawPayload === "string" ? rawPayload : String(rawPayload || "");
    const byteSize = Buffer.byteLength(payloadString, "utf8");

    if (byteSize > MAX_PAYLOAD_BYTES) {
      console.error(`Import payload size ${byteSize} bytes exceeds platform upload limit of ${MAX_PAYLOAD_BYTES} bytes`);
      return sendError(res, 413, "payload-too-large", "Import backup file size exceeds 4.0 MB payload limit");
    }

    if (!payloadString.trim()) {
      return sendError(res, 400, "invalid-argument", "Import payload content is empty");
    }

    const analysis = await analyzeImportPayload({
      userId: user.uid,
      rawPayload: payloadString,
    });

    return res.status(200).json(analysis);
  } catch (err) {
    if (err instanceof BackupValidationError) {
      return res.status(err.statusCode || 400).json({
        error: {
          code: err.code || "invalid-backup-payload",
          message: err.message,
          details: err.details || null,
        },
      });
    }

    if (err instanceof SyntaxError) {
      return sendError(res, 400, "malformed-json", `JSON Syntax Error: ${err.message}`);
    }

    console.error("Error in /api/user/import/analyze:", err);
    return sendError(res, 500, "internal", "Failed to analyze import backup payload");
  }
}
