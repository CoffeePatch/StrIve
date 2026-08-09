import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getContinueWatching } from '../../services/libraryService';
import { getOrFetch, CACHE_KEYS, TTL } from '../../util/cache/sessionCache';

export function useContinueWatching(userId) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const isBrowsePage = location.pathname === '/';

  useEffect(() => {
    if (!userId || !isBrowsePage) {
      return;
    }

    let active = true;
    const fetchItems = async () => {
      setLoading(true);
      try {
        const cacheKey = CACHE_KEYS.CONTINUE_WATCHING(userId);
        
        // Fetch via session cache (2 min TTL)
        const fetched = await getOrFetch({
          key: cacheKey,
          ttl: TTL.CONTINUE_WATCHING,
          fetcher: async () => {
            // We fetch from the proxy function which calls the BFF directly.
            // Hydration and sorting are natively handled in the PostgreSQL backend.
            return await getContinueWatching(userId, { limit: 20 });
          }
        });

        // TV-first sort, then order by updatedAt descending
        const sorted = [...fetched].sort((left, right) => {
          const isLeftTV = left.mediaType === 'tv' || left.media_type === 'tv';
          const isRightTV = right.mediaType === 'tv' || right.media_type === 'tv';

          if (isLeftTV && !isRightTV) return -1;
          if (!isLeftTV && isRightTV) return 1;

          const leftTime = left.tracking?.updatedAt?.toMillis ? left.tracking.updatedAt.toMillis() : new Date(left.tracking?.updatedAt || 0).getTime();
          const rightTime = right.tracking?.updatedAt?.toMillis ? right.tracking.updatedAt.toMillis() : new Date(right.tracking?.updatedAt || 0).getTime();
          return rightTime - leftTime;
        });

        const sliced = sorted.slice(0, 15);

        if (active) {
          setItems(sliced);
        }
      } catch (err) {
        console.error('Failed to fetch continue watching items:', err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchItems();
    return () => { active = false; };
  }, [userId, isBrowsePage]);

  return { items, loading };
}
