import { verifyAuth } from "../_lib/authMiddleware.js";
import { sendError } from "../_lib/utils.js";
import { exportUserData } from "../_lib/services/exportService.js";

const MAX_PAYLOAD_BYTES = 4.5 * 1024 * 1024; // Vercel 4.5MB serverless response limit

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendError(res, 405, "method-not-allowed", "Only GET requests are allowed");
  }

  let user;
  try {
    user = await verifyAuth(req);
  } catch (error) {
    return sendError(res, 401, "unauthenticated", error?.message || "Authentication required");
  }

  const format = (req.query?.format || "json").toLowerCase();
  if (format !== "json" && format !== "csv") {
    return sendError(res, 400, "invalid-argument", "Format parameter must be 'json' or 'csv'");
  }

  try {
    const exportResult = await exportUserData({ userId: user.uid, format });
    const dateStr = new Date().toISOString().split("T")[0];

    if (format === "csv") {
      const csvContent = typeof exportResult === "string" ? exportResult : String(exportResult);
      const byteSize = Buffer.byteLength(csvContent, "utf8");

      if (byteSize > MAX_PAYLOAD_BYTES) {
        console.error(`Export payload size ${byteSize} bytes exceeds platform limit of ${MAX_PAYLOAD_BYTES} bytes`);
        return sendError(res, 413, "payload-too-large", "Export dataset exceeds platform response size limit");
      }

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="strive-library-${dateStr}.csv"`);
      return res.status(200).send(csvContent);
    }

    // JSON export
    const jsonString = JSON.stringify(exportResult, null, 2);
    const byteSize = Buffer.byteLength(jsonString, "utf8");

    if (byteSize > MAX_PAYLOAD_BYTES) {
      console.error(`Export payload size ${byteSize} bytes exceeds platform limit of ${MAX_PAYLOAD_BYTES} bytes`);
      return sendError(res, 413, "payload-too-large", "Export dataset exceeds platform response size limit");
    }

    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="strive-backup-${dateStr}.json"`);
    return res.status(200).send(jsonString);
  } catch (err) {
    console.error("Error generating user export:", err);
    return sendError(res, 500, "internal", "Failed to generate user export");
  }
}
