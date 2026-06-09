import { useState, useEffect } from 'react';
import { getOrFetch, CACHE_KEYS, TTL, sessionCache } from '../../util/cache/sessionCache';

// Bounded-scope memory cache for TV season episodes to speed up tab transitions.
// Cleared on page refresh/navigation session restart.
const cache = new Map();

/**
 * Hook to fetch episodes for a specific season from our Vercel backend.
 * Implements client-side in-memory caching and in-flight request deduplication.
 * @param {string|number} tvId - The TMDB TV show ID
 * @param {number} seasonNumber - The season number
 * @returns {Object} { data, loading, error, refetch }
 */
const useTvSeasonEpisodes = (tvId, seasonNumber) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    const fetchEpisodes = async (forceRefresh = false) => {
      if (!tvId || seasonNumber === null || seasonNumber === undefined) {
        if (active) setLoading(false);
        return;
      }

      const cacheKey = `${tvId}_${seasonNumber}`;
      const sessionCacheKey = CACHE_KEYS.TV_SEASON(tvId, seasonNumber);

      // 1. Check fast in-memory cache first
      if (!forceRefresh && cache.has(cacheKey)) {
        if (active) {
          setData(cache.get(cacheKey));
          setLoading(false);
        }
        return;
      }

      if (active) {
        setLoading(true);
        setError(null);
      }

      try {
        const result = await getOrFetch({
          key: sessionCacheKey,
          ttl: TTL.TV_SEASON,
          fetcher: async () => {
            const url = `/api/tv/episodes?tvId=${tvId}&season=${seasonNumber}`;
            const response = await fetch(url);
            
            if (!response.ok) {
              throw new Error(`Failed to fetch season episodes: ${response.status}`);
            }

            return await response.json();
          }
        });

        // Store in local memory cache
        cache.set(cacheKey, result);

        if (active) {
          setData(result);
        }
      } catch (err) {
        if (active) {
          console.error('Error in useTvSeasonEpisodes:', err);
          setError(err.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchEpisodes();

    return () => {
      active = false;
    };
  }, [tvId, seasonNumber]);

  const refetch = () => {
    if (!tvId || seasonNumber === null || seasonNumber === undefined) return;
    const cacheKey = `${tvId}_${seasonNumber}`;
    const sessionCacheKey = CACHE_KEYS.TV_SEASON(tvId, seasonNumber);
    cache.delete(cacheKey);
    sessionCache.remove(sessionCacheKey);
    // Setting state to trigger re-run of useEffect
    setData(null);
    setLoading(true);
  };

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export default useTvSeasonEpisodes;
