import { useState, useEffect } from 'react';
import { requestMetadataEnrichment, subscribeMetadataUpdates } from '../../services/metadataEnrichmentCoordinator';

/**
 * Custom hook to fetch IMDb title information by TMDB ID
 * @param {string} tmdbId - The TMDB ID to lookup
 * @param {string} mediaType - The media type ('movie' or 'tv')
 * @returns {Object} Object containing data, loading, and error states
 */
const useImdbTitle = (tmdbId, mediaType = 'movie', options = {}) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { userId = null, titleKey = null, persist = true, forceRefresh = false, prefetchedImdbId = null } = options;

  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeMetadataUpdates((result) => {
      if (!active || !result) return;
      if (String(result.tmdbId) !== String(tmdbId)) return;
      if (result.imdbTitle) {
        setData(result.imdbTitle);
      }
    });

    const fetchImdbTitle = async () => {
      try {
        if (active) {
          setLoading(true);
          setError(null);
        }

        const titleData = await requestMetadataEnrichment({
          item: {
            tmdbId,
            media_type: mediaType,
            titleKey,
          },
          userId,
          titleKey,
          persist: persist && Boolean(userId && titleKey),
          trackStatus: Boolean(userId && titleKey),
          forceRefresh,
          prefetchedImdbId,
        });

        if (active && titleData?.imdbTitle) {
          setData(titleData.imdbTitle);
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
      unsubscribe();
    };
  }, [tmdbId, mediaType, userId, titleKey, persist, forceRefresh, prefetchedImdbId]);

  return { data, loading, error };
};

export default useImdbTitle;