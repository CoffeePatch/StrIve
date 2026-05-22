// Vercel serverless functions environment

export async function fetchWithTimeout(
  resource,
  options = {},
  timeoutMs = 8000,
) {
  const f = globalThis.fetch;
  return await Promise.race([
    f(resource, options || {}),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), timeoutMs),
    ),
  ]);
}

export function pLimit(concurrency) {
  let activeCount = 0;
  const queue = [];

  const next = () => {
    activeCount--;
    if (queue.length > 0) queue.shift()();
  };

  const run = async (fn) => {
    if (activeCount >= concurrency) {
      await new Promise((resolve) => queue.push(resolve));
    }
    activeCount++;
    try {
      return await fn();
    } finally {
      next();
    }
  };

  return run;
}

export function parseTvTitleKey(rawTitleKey) {
  const titleKey = typeof rawTitleKey === "string" ? rawTitleKey.trim() : "";
  if (!/^tmdb_tv_\d+$/.test(titleKey)) {
    throw new Error("invalid-argument: titleKey must match tmdb_tv_<id>.");
  }
  return titleKey;
}

export function sendError(res, status, code, message) {
  res.status(status).json({ error: { code, message } });
}

// Simple in-memory cache for external APIs
const memoryCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;

export function getCached(key) {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    memoryCache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache(key, data) {
  memoryCache.set(key, { data, timestamp: Date.now() });
}
