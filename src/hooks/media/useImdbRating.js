import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { getImdbId } from '../../util/imdb/imdbResolver';
import IMDbService from '../../util/imdb/imdbService';
import { sessionCache, CACHE_KEYS, TTL } from '../../util/cache/sessionCache';

// Simple memory cache to prevent re-fetching
const cache = new Map();
const inFlight = new Map();
const NO_RATING = { unavailable: true };
const negativeCacheExpiry = new Map();

// Simple global cooldown to avoid hammering the API when rate-limited
const RATE_LIMIT_COOLDOWN_MS = 60 * 1000;
let rateLimitUntil = 0;

const isRateLimitedError = (error) => {
  if (!error) return false;
  const status = error?.status ?? error?.statusCode;
  if (status === 429) return true;
  const message = String(error?.message ?? '');
  return message.includes('Status: 429') || message.includes(' 429');
};

const registerRateLimit = () => {
  const nextUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
  rateLimitUntil = Math.max(rateLimitUntil, nextUntil);
  return rateLimitUntil;
};

const getCachedRating = (cacheKey) => {
  if (!cache.has(cacheKey)) return undefined;

  const cached = cache.get(cacheKey);
  if (cached !== NO_RATING) return cached;

  const expiresAt = negativeCacheExpiry.get(cacheKey);
  if (expiresAt && Date.now() > expiresAt) {
    cache.delete(cacheKey);
    negativeCacheExpiry.delete(cacheKey);
    return undefined;
  }

  return NO_RATING;
};

const setNegativeCache = (cacheKey, ttlMs = null) => {
  cache.set(cacheKey, NO_RATING);
  if (typeof ttlMs === 'number' && ttlMs > 0) {
    negativeCacheExpiry.set(cacheKey, Date.now() + ttlMs);
  } else {
    negativeCacheExpiry.delete(cacheKey);
  }
};

// Global refetch trigger counter
let globalRefetchTrigger = 0;
const refetchListeners = new Set();

// Request queue to prevent overwhelming the API
const requestQueue = [];
let activeRequests = 0;
const MAX_CONCURRENT_REQUESTS = 3; // Limit concurrent API calls
const REQUEST_DELAY = 100; // Small delay between requests (ms)

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};

const extractRatingData = (data) => {
  const score =
    toNumber(data?.rating?.aggregateRating) ??
    toNumber(data?.rating?.aggregate_rating) ??
    toNumber(data?.rating?.ratingValue) ??
    toNumber(data?.aggregateRating) ??
    toNumber(data?.aggregate_rating) ??
    toNumber(data?.imdbRating);

  const votes =
    toNumber(data?.rating?.voteCount) ??
    toNumber(data?.rating?.vote_count) ??
    toNumber(data?.rating?.votes_count) ??
    toNumber(data?.rating?.ratingCount) ??
    toNumber(data?.voteCount) ??
    toNumber(data?.vote_count) ??
    toNumber(data?.votes_count) ??
    toNumber(data?.imdbVotes) ??
    0;

  return {
    score,
    votes
  };
};

const extractPrefetchedRating = (prefetched) => {
  if (!prefetched) return null;

  const score =
    toNumber(prefetched?.imdbRating) ??
    toNumber(prefetched?.imdb_rating) ??
    toNumber(prefetched?.rating?.aggregateRating) ??
    toNumber(prefetched?.rating?.ratingValue);

  if (!score) return null;

  const votes =
    toNumber(prefetched?.imdbVotes) ??
    toNumber(prefetched?.imdb_vote_count) ??
    toNumber(prefetched?.rating?.voteCount) ??
    toNumber(prefetched?.rating?.ratingCount) ??
    0;

  return { score, votes };
};

// Process the request queue
const processQueue = async () => {
  if (activeRequests >= MAX_CONCURRENT_REQUESTS || requestQueue.length === 0) {
    return;
  }

  const request = requestQueue.shift();
  if (request) {
    activeRequests++;
    try {
      await request();
    } catch (err) {
      console.error('Queue processing error:', err);
    } finally {
      activeRequests--;
      // Small delay before processing next request
      setTimeout(processQueue, REQUEST_DELAY);
    }
  }
};

// Add request to queue
const queueRequest = (requestFn) => {
  return new Promise((resolve, reject) => {
    requestQueue.push(async () => {
      try {
        const result = await requestFn();
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
    processQueue();
  });
};

// Global function to trigger refetch for all instances
export const triggerGlobalRefetch = () => {
  globalRefetchTrigger++;
  refetchListeners.forEach(listener => listener());
};

/**
 * Lightweight hook for fetching just the IMDb rating
 * Optimized for "just-in-time" enrichment on search results
 * @param {string|number} tmdbId - The TMDB ID
 * @param {string} mediaType - The media type ('movie' or 'tv')
 * @param {Object|null} prefetched - Optional preloaded IMDb data from DB
 * @param {Object|boolean} options - Optional options or enabled boolean
 * @returns {Object} Object containing rating and loading state
 */
export const useImdbRating = (tmdbId, mediaType = 'movie', prefetched = null, options = {}) => {
  const [rating, setRating] = useState(null);
  const [loading, setLoading] = useState(false);
  const normalizedMediaType = mediaType === 'tv' ? 'tv' : 'movie';
  const enabled = typeof options === 'boolean' ? options : options?.enabled !== false;

  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const safeSetRating = useCallback((valueOrUpdater) => {
    if (mountedRef.current) {
      setRating(valueOrUpdater);
    }
  }, []);

  const safeSetLoading = useCallback((valueOrUpdater) => {
    if (mountedRef.current) {
      setLoading(valueOrUpdater);
    }
  }, []);

  // Derive stable primitives from prefetched data so the hook doesn't re-fetch on every render.
  const prefetchedScore =
    toNumber(prefetched?.imdbRating) ??
    toNumber(prefetched?.imdb_rating) ??
    toNumber(prefetched?.rating?.aggregateRating) ??
    toNumber(prefetched?.rating?.ratingValue) ??
    null;

  const prefetchedVotes =
    toNumber(prefetched?.imdbVotes) ??
    toNumber(prefetched?.imdb_vote_count) ??
    toNumber(prefetched?.rating?.voteCount) ??
    toNumber(prefetched?.rating?.ratingCount) ??
    0;

  const prefetchedRating = useMemo(() => {
    if (!prefetchedScore) return null;
    return { score: prefetchedScore, votes: prefetchedVotes };
  }, [prefetchedScore, prefetchedVotes]);

  const prefetchedImdbId = useMemo(() => {
    const imdbId = prefetched?.imdbId ?? prefetched?.imdb_id;
    return imdbId ? String(imdbId) : null;
  }, [prefetched?.imdbId, prefetched?.imdb_id]);

  const fetchRating = useCallback(async (forceRefresh = false) => {
    if (!tmdbId) return;

    const cacheKey = `${normalizedMediaType}_${tmdbId}`;

    // When disabled, never fetch. Still display prefetched values if present.
    if (!enabled) {
      safeSetLoading(false);
      safeSetRating(prefetchedRating || null);
      return;
    }

    // 1. Prefer already persisted IMDb values from DB when present
    if (prefetchedRating && !forceRefresh) {
      safeSetRating(prefetchedRating);
      cache.set(cacheKey, prefetchedRating);
      return;
    }

    // 2. Check cache (skip if force refresh)
    if (!forceRefresh) {
      const cached = getCachedRating(cacheKey);
      if (cached !== undefined) {
        safeSetRating(cached === NO_RATING ? null : cached);
        return;
      }

      // Check full IMDb title session cache
      let imdbId = prefetchedImdbId;
      if (!imdbId) {
        try {
          imdbId = await getImdbId(String(tmdbId), normalizedMediaType);
        } catch {
          // Ignore resolution errors for local check
        }
      }
      if (imdbId) {
        const cachedTitle = sessionCache.get(CACHE_KEYS.IMDB_TITLE(imdbId));
        if (cachedTitle) {
          const ratingData = extractRatingData(cachedTitle);
          if (ratingData.score) {
            cache.set(cacheKey, ratingData);
            safeSetRating(ratingData);
            return;
          }
        }
      }
    }

    // 2.5 If we've been rate-limited recently, avoid additional network work.
    if (Date.now() < rateLimitUntil) {
      return;
    }

    // 3. Reuse an in-flight request for the same title
    if (!forceRefresh && inFlight.has(cacheKey)) {
      safeSetLoading(true);
      try {
        await inFlight.get(cacheKey);
        const cached = getCachedRating(cacheKey);
        safeSetRating(cached === NO_RATING ? null : cached || null);
      } finally {
        safeSetLoading(false);
      }
      return;
    }

    safeSetLoading(true);

    let queuedRequest;
    try {
      // Use the request queue to prevent overwhelming the API
      queuedRequest = queueRequest(async () => {
        if (Date.now() < rateLimitUntil) {
          setNegativeCache(cacheKey, Math.max(0, rateLimitUntil - Date.now()));
          safeSetRating(null);
          return;
        }

        // 2. Check if IMDb service is configured
        let imdbService;
        try {
          imdbService = new IMDbService();
        } catch (serviceError) {
          // IMDb service not configured, silently skip
          console.debug('IMDb rating not available:', serviceError.message);
          safeSetRating(null);
          return;
        }

        // 3. Get IMDb ID (using existing resolver which has its own cache)
        let imdbId = prefetchedImdbId;
        if (!imdbId) {
          try {
            imdbId = await getImdbId(String(tmdbId), normalizedMediaType);
          } catch (resolverError) {
            console.debug('Failed to resolve IMDb ID for', tmdbId, ':', resolverError.message);
            setNegativeCache(cacheKey, 5 * 60 * 1000);
            safeSetRating(null);
            return;
          }
        }
        
        if (imdbId) {
          // 4. Fetch Rating with retry logic
          let retries = 3;
          let lastError = null;
          
          while (retries > 0) {
            try {
              const data = await imdbService.getTitleById(imdbId);
              
              // Bidirectional Cache: save full title details in session cache
              if (data) {
                try {
                  sessionCache.set(CACHE_KEYS.IMDB_TITLE(imdbId), data, TTL.IMDB_TITLE);
                } catch {
                  // ignore
                }
              }
              
              const ratingData = extractRatingData(data);

              // Only cache valid ratings
              if (ratingData.score) {
                // 5. Save to Cache
                cache.set(cacheKey, ratingData);
                safeSetRating(ratingData);
                return; // Success, exit retry loop
              }

              // Negative cache to avoid repeatedly calling APIs for titles without rating data
              setNegativeCache(cacheKey);
              safeSetRating(null);
              break; // No rating available, exit retry loop
            } catch (err) {
              if (isRateLimitedError(err)) {
                const until = registerRateLimit();
                setNegativeCache(cacheKey, Math.max(0, until - Date.now()));
                safeSetRating(null);
                return;
              }

              lastError = err;
              retries--;
              if (retries > 0) {
                // Exponential backoff: wait before retrying
                await new Promise(resolve => setTimeout(resolve, (4 - retries) * 500));
              }
            }
          }
          
          if (lastError) {
            console.debug('Failed to load IMDb rating for', tmdbId, 'after retries:', lastError.message);
          }

          setNegativeCache(cacheKey);
          safeSetRating(null);
          return;
        }

        setNegativeCache(cacheKey);
        safeSetRating(null);
      });

      inFlight.set(cacheKey, queuedRequest);
      await queuedRequest;
    } catch (err) {
      // Fail silently - the badge just won't appear
      console.debug('Failed to load IMDb rating for', tmdbId, ':', err.message);
    } finally {
      inFlight.delete(cacheKey);
      safeSetLoading(false);
    }
  }, [tmdbId, normalizedMediaType, enabled, prefetchedRating, prefetchedImdbId, safeSetLoading, safeSetRating]);

  useEffect(() => {
    fetchRating();
  }, [fetchRating]);

  // Listen for global refetch triggers
  useEffect(() => {
    if (!enabled) return;

    const listener = () => {
      // Only refetch if we don't have a rating yet
      if (!rating) {
        fetchRating(true);
      }
    };

    refetchListeners.add(listener);
    return () => refetchListeners.delete(listener);
  }, [enabled, rating, fetchRating]);

  return { rating, loading };
};
