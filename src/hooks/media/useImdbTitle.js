import { useState, useEffect } from 'react';
import IMDbService from '../../util/imdb/imdbService';
import { getImdbId } from '../../util/imdb/imdbResolver';
import { getOrFetch, CACHE_KEYS, TTL } from '../../util/cache/sessionCache';

/**
 * Custom hook to fetch IMDb title information by TMDB ID
 * @param {string} tmdbId - The TMDB ID to lookup
 * @param {string} mediaType - The media type ('movie' or 'tv')
 * @returns {Object} Object containing data, loading, and error states
 */
const useImdbTitle = (tmdbId, mediaType = 'movie') => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;

    const fetchImdbTitle = async () => {
      try {
        if (active) {
          setLoading(true);
          setError(null);
        }
        
        console.log('🎬 [IMDb Hook] Starting fetch for TMDB ID:', tmdbId, 'Type:', mediaType);

        // Create an instance of IMDbService (will throw if env not configured)
        let imdbService;
        try {
          imdbService = new IMDbService();
          console.log('✅ [IMDb Hook] Service created successfully');
        } catch (serviceError) {
          // IMDb service not configured, gracefully disable
          console.error('❌ [IMDb Hook] Service creation failed:', serviceError.message);
          if (active) {
            setData(null);
            setError(serviceError.message);
            setLoading(false);
          }
          return;
        }

        // First get the IMDb ID using the TMDB ID
        console.log('🔍 [IMDb Hook] Getting IMDb ID from TMDB...');
        const imdbId = await getImdbId(tmdbId, mediaType);
        console.log('🔗 [IMDb Hook] IMDb ID:', imdbId || 'NOT FOUND');

        if (!imdbId) {
          // No IMDb ID found for this TMDB ID
          console.warn('⚠️ [IMDb Hook] No IMDb ID found for this content');
          if (active) {
            setData(null);
            setLoading(false);
          }
          return;
        }

        // Fetch the title data
        const titleData = await getOrFetch({
          key: CACHE_KEYS.IMDB_TITLE(imdbId),
          ttl: TTL.IMDB_TITLE,
          fetcher: async () => {
            console.log('📡 [IMDb Hook] Fetching data from IMDb API...');
            return await imdbService.getTitleById(imdbId);
          }
        });

        console.log('✅ [IMDb Hook] Data received from cache or API:', titleData);
        console.log('📊 [IMDb Hook] Rating:', titleData?.rating);

        if (active) {
          setData(titleData);
        }
      } catch (err) {
        if (active) {
          setError(err.message);
          console.error('❌ [IMDb Hook] Error:', err);
        }
      } finally {
        if (active) {
          setLoading(false);
          console.log('🏁 [IMDb Hook] Fetch complete');
        }
      }
    };

    if (tmdbId) {
      fetchImdbTitle();
    } else {
      setLoading(false);
    }

    return () => {
      active = false;
    };
  }, [tmdbId, mediaType]);

  return { data, loading, error };
};

export default useImdbTitle;