import { sendError } from "./utils.js";

export function handleApiError(res, err) {
  if (err.message && err.message.startsWith("unauthenticated:")) {
    return sendError(res, 401, "unauthenticated", err.message.split(": ")[1] || err.message);
  }
  if (err.name === "ServiceError" || err.status) {
    const status = err.status || 500;
    const codes = {
      400: "invalid-argument",
      401: "unauthenticated",
      403: "permission-denied",
      404: "not-found",
      409: "conflict"
    };
    const code = codes[status] || "internal";
    return sendError(res, status, code, err.message);
  }
  
  console.error("Unexpected API Error:", err);
  return sendError(res, 500, "internal", "An unexpected internal error occurred.");
}
