const PREFIX = 'strive_library_pipeline_v1_';
const inMemoryFallback = new Map();
const inFlightRequests = new Map();

const getPrefixedKey = (key) => `${PREFIX}${key}`;

const getStorage = () => {
  if (typeof globalThis !== 'undefined' && globalThis.sessionStorage) {
    return globalThis.sessionStorage;
  }
  return null;
};

export const getCachedLibraryData = (key) => {
  const prefixedKey = getPrefixedKey(key);
  const storage = getStorage();

  try {
    if (storage?.getItem) {
      const stored = storage.getItem(prefixedKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.expiresAt && Date.now() > parsed.expiresAt) {
          storage.removeItem(prefixedKey);
          return null;
        }
        return parsed.data;
      }
    }
  } catch (err) {
    console.warn('Library pipeline cache read failed:', err?.message || err);
  }

  const inMem = inMemoryFallback.get(prefixedKey);
  if (inMem) {
    if (inMem.expiresAt && Date.now() > inMem.expiresAt) {
      inMemoryFallback.delete(prefixedKey);
      return null;
    }
    return inMem.data;
  }

  return null;
};

export const setCachedLibraryData = (key, value, ttlMs = 2 * 60 * 1000) => {
  const prefixedKey = getPrefixedKey(key);
  const payload = { data: value, expiresAt: Date.now() + ttlMs };
  const storage = getStorage();

  try {
    if (storage?.setItem) {
      storage.setItem(prefixedKey, JSON.stringify(payload));
      return;
    }
  } catch (err) {
    console.warn('Library pipeline cache write failed:', err?.message || err);
  }

  inMemoryFallback.set(prefixedKey, payload);
};

export const invalidateLibraryPipelineCache = (userId) => {
  if (!userId) return;
  const storage = getStorage();
  const suffix = `${userId}`;

  try {
    if (storage?.removeItem) {
      const keysToRemove = [];
      for (let i = 0; i < storage.length; i += 1) {
        const candidate = storage.key(i);
        if (candidate && candidate.startsWith(PREFIX) && candidate.includes(suffix)) {
          keysToRemove.push(candidate);
        }
      }
      keysToRemove.forEach((candidate) => storage.removeItem(candidate));
    }
  } catch (err) {
    console.warn('Library pipeline cache invalidation failed:', err?.message || err);
  }

  for (const [candidateKey] of inMemoryFallback.entries()) {
    if (candidateKey.includes(suffix)) {
      inMemoryFallback.delete(candidateKey);
    }
  }
};

export const getOrFetchLibraryData = async ({ key, ttlMs, fetcher }) => {
  const cached = getCachedLibraryData(key);
  if (cached !== null && cached !== undefined) return cached;

  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }

  const fetchPromise = (async () => {
    try {
      const fresh = await fetcher();
      if (fresh !== null && fresh !== undefined) {
        setCachedLibraryData(key, fresh, ttlMs);
      }
      return fresh;
    } finally {
      inFlightRequests.delete(key);
    }
  })();

  inFlightRequests.set(key, fetchPromise);
  return fetchPromise;
};
