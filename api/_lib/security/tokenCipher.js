import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";

function getSecretKey() {
  const envKey = process.env.SIMKL_TOKEN_ENCRYPTION_KEY || process.env.SIMKL_CLIENT_SECRET || process.env.DATABASE_URL || "strive_simkl_encryption_secret_default_key_32b";
  return crypto.createHash("sha256").update(envKey).digest(); // Guarantees exactly 32 bytes (256 bits)
}

/**
 * Encrypts a raw token string using AES-256-GCM
 */
export function encryptToken(plainText) {
  if (!plainText) return null;
  const key = getSecretKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  
  return `${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted token string
 */
export function decryptToken(cipherTextStr) {
  if (!cipherTextStr) return null;
  try {
    const parts = cipherTextStr.split(":");
    if (parts.length !== 3) return null;
    
    const [ivHex, authTagHex, encryptedHex] = parts;
    const key = getSecretKey();
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("Token decryption failed:", err.message);
    return null;
  }
}

/**
 * Generates a signed OAuth state bound to the authenticated user ID
 */
export function generateOAuthState(userId) {
  if (!userId) throw new Error("userId is required for OAuth state generation");
  const timestamp = Date.now();
  const nonce = crypto.randomBytes(8).toString("hex");
  const payload = `${userId}:${timestamp}:${nonce}`;
  const key = getSecretKey();
  const hmac = crypto.createHmac("sha256", key).update(payload).digest("hex");
  return Buffer.from(`${payload}:${hmac}`).toString("base64url");
}

/**
 * Validates a signed OAuth state for a specific user ID
 */
export function verifyOAuthState(stateStr, expectedUserId) {
  if (!stateStr || !expectedUserId) return false;
  try {
    const decoded = Buffer.from(stateStr, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 4) return false;
    
    const [userId, timestampStr, nonce, hmac] = parts;
    if (userId !== expectedUserId) return false;
    
    const timestamp = Number(timestampStr);
    if (!Number.isFinite(timestamp) || Date.now() - timestamp > 15 * 60 * 1000) { // 15 min TTL
      return false;
    }
    
    const payload = `${userId}:${timestampStr}:${nonce}`;
    const key = getSecretKey();
    const expectedHmac = crypto.createHmac("sha256", key).update(payload).digest("hex");
    
    const bufHmac = Buffer.from(hmac, "hex");
    const bufExpected = Buffer.from(expectedHmac, "hex");
    if (bufHmac.length !== bufExpected.length) return false;

    return crypto.timingSafeEqual(bufHmac, bufExpected);
  } catch (err) {
    console.error("OAuth state verification failed:", err.message);
    return false;
  }
}
