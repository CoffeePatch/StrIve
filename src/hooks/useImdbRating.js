import { useState, useEffect, useCallback } from 'react';
import { getImdbId } from '../util/imdbResolver';
import IMDbService from '../util/imdbService';

// Simple memory cache to prevent re-fetching
const cache = new Map();
const inFlight = new Map();
const NO_RATING = { unavailable: true };

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
    toNumber(data?.rating?.ratingValue) ??
    toNumber(data?.aggregateRating) ??
    toNumber(data?.imdbRating);

  const votes =
    toNumber(data?.rating?.voteCount) ??
    toNumber(data?.rating?.ratingCount) ??
    toNumber(data?.voteCount) ??
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
 * @returns {Object} Object containing rating and loading state
 */
export const useImdbRating = (tmdbId, mediaType = 'movie', prefetched = null) => {
  const [rating, setRating] = useState(null);
  const [loading, setLoading] = useState(false);
  const normalizedMediaType = mediaType === 'tv' ? 'tv' : 'movie';
  const prefetchedRating = extractPrefetchedRating(prefetched);

  const fetchRating = useCallback(async (forceRefresh = false) => {
    if (!tmdbId) return;

    // 1. Prefer already persisted IMDb values from DB when present
    if (prefetchedRating && !forceRefresh) {
      setRating(prefetchedRating);
      cache.set(`${normalizedMediaType}_${tmdbId}`, prefetchedRating);
      return;
    }

    // 2. Check cache (skip if force refresh)
    const cacheKey = `${normalizedMediaType}_${tmdbId}`;
    if (!forceRefresh && cache.has(cacheKey)) {
      const cached = cache.get(cacheKey);
      setRating(cached === NO_RATING ? null : cached);
      return;
    }

    // 3. Reuse an in-flight request for the same title
    if (!forceRefresh && inFlight.has(cacheKey)) {
      setLoading(true);
      try {
        await inFlight.get(cacheKey);
        const cached = cache.get(cacheKey);
        setRating(cached === NO_RATING ? null : cached || null);
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);

    let queuedRequest;
    try {
      // Use the request queue to prevent overwhelming the API
      queuedRequest = queueRequest(async () => {
        // 2. Check if IMDb service is configured
        let imdbService;
        try {
          imdbService = new IMDbService();
        } catch (serviceError) {
          // IMDb service not configured, silently skip
          console.debug('IMDb rating not available:', serviceError.message);
          setRating(null);
          setLoading(false);
          return;
        }

        // 3. Get IMDb ID (using existing resolver which has its own cache)
        const imdbId = await getImdbId(String(tmdbId), normalizedMediaType);
        
        if (imdbId) {
          // 4. Fetch Rating with retry logic
          let retries = 3;
          let lastError = null;
          
          while (retries > 0) {
            try {
              const data = await imdbService.getTitleById(imdbId);
              
              const ratingData = extractRatingData(data);

              // Only cache valid ratings
              if (ratingData.score) {
                // 5. Save to Cache
                cache.set(cacheKey, ratingData);
                setRating(ratingData);
                return; // Success, exit retry loop
              }

              // Negative cache to avoid repeatedly calling APIs for titles without rating data
              cache.set(cacheKey, NO_RATING);
              setRating(null);
              break; // No rating available, exit retry loop
            } catch (err) {
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

          cache.set(cacheKey, NO_RATING);
          setRating(null);
          return;
        }

        cache.set(cacheKey, NO_RATING);
        setRating(null);
      });

      inFlight.set(cacheKey, queuedRequest);
      await queuedRequest;
    } catch (err) {
      // Fail silently - the badge just won't appear
      console.debug('Failed to load IMDb rating for', tmdbId, ':', err.message);
    } finally {
      inFlight.delete(`${normalizedMediaType}_${tmdbId}`);
      setLoading(false);
    }
  }, [tmdbId, normalizedMediaType, prefetchedRating]);

  useEffect(() => {
    fetchRating();
  }, [fetchRating]);

  // Listen for global refetch triggers
  useEffect(() => {
    const listener = () => {
      // Only refetch if we don't have a rating yet
      if (!rating) {
        fetchRating(true);
      }
    };
    
    refetchListeners.add(listener);
    return () => refetchListeners.delete(listener);
  }, [rating, fetchRating]);

  return { rating, loading };
};
