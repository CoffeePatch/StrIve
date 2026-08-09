import { admin } from "./firebaseAdmin.js";

/**
 * Verifies Firebase Auth token from the Authorization header.
 * Returns the decoded token (which includes uid), or throws an error.
 *
 * @param {Request} req The incoming HTTP request
 * @returns {Promise<admin.auth.DecodedIdToken>} The decoded token
 */
export async function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("unauthenticated: Missing or invalid Authorization header");
  }

  // Allow test scripts to mock the verified token
  if (process.env.NODE_ENV === "test" && process.env.MOCK_AUTH_USER_ID) {
    if (process.env.MOCK_AUTH_USER_ID === "null") throw new Error("unauthenticated: Invalid token");
    return { uid: process.env.MOCK_AUTH_USER_ID };
  }

  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await admin.auth().verifyIdToken(token);
    return decodedToken;
  } catch {
    throw new Error("unauthenticated: Invalid token");
  }
}
