const PREFIX = "strive_cache_v1_";
const inMemoryFallback = new Map();
const inFlightRequests = new Map();

export const TTL = {
  MOVIE_DETAILS: 24 * 60 * 60 * 1000,
  TV_DETAILS: 24 * 60 * 60 * 1000,
  TV_SEASON: 24 * 60 * 60 * 1000,
  IMDB_TITLE: 6 * 60 * 60 * 1000,
};

export const CACHE_KEYS = {
  MOVIE_DETAILS: (id) => `movie_details_${id}`,
  TV_DETAILS: (id) => `tv_details_${id}`,
  TV_SEASON: (tvId, num) => `tv_season_${tvId}_${num}`,
  IMDB_TITLE: (imdbId) => `imdb_title_${imdbId}`,
};

export const sessionCache = {
  get: (key) => {
    const prefixedKey = `${PREFIX}${key}`;
    try {
      const stored = sessionStorage.getItem(prefixedKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
          sessionStorage.removeItem(prefixedKey);
          return null;
        }
        return parsed.data;
      }
    } catch (err) {
      console.warn("sessionStorage read failed:", err.message);
    }
    
    // Fallback logic
    const inMem = inMemoryFallback.get(prefixedKey);
    if (inMem) {
      if (inMem.expiresAt && Date.now() > inMem.expiresAt) {
        inMemoryFallback.delete(prefixedKey);
        return null;
      }
      return inMem.data;
    }
    return null;
  },

  set: (key, value, ttlMs = 24 * 60 * 60 * 1000) => {
    const prefixedKey = `${PREFIX}${key}`;
    const expiresAt = Date.now() + ttlMs;
    const payload = { data: value, expiresAt };
    try {
      sessionStorage.setItem(prefixedKey, JSON.stringify(payload));
      return;
    } catch (err) {
      console.warn("sessionStorage write failed, falling back to memory:", err.message);
    }
    inMemoryFallback.set(prefixedKey, payload);
  },

  remove: (key) => {
    const prefixedKey = `${PREFIX}${key}`;
    try {
      sessionStorage.removeItem(prefixedKey);
    } catch (err) {
      console.warn("sessionStorage remove failed:", err.message);
    }
    inMemoryFallback.delete(prefixedKey);
  },

  clear: () => {
    try {
      const keysToRemove = [];
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith(PREFIX)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => sessionStorage.removeItem(key));
    } catch (err) {
      console.warn("sessionStorage clear failed:", err.message);
    }
    inMemoryFallback.clear();
  }
};

export const getOrFetch = async ({ key, ttl, fetcher }) => {
  // Check cache first
  const cached = sessionCache.get(key);
  if (cached !== null) return cached;

  // Check in-flight requests to deduplicate parallel fetches
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }

  const fetchPromise = (async () => {
    try {
      const fresh = await fetcher();
      if (fresh !== null && fresh !== undefined) {
        sessionCache.set(key, fresh, ttl);
      }
      return fresh;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, fetchPromise);
  return fetchPromise;
};
