const tvCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000;

export function getCached(key: string): any | null {
  const entry = tvCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    tvCache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache(key: string, data: any): void {
  tvCache.set(key, { data, timestamp: Date.now() });
}
