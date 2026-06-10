import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { getAllLibraryItems } from '../../services/libraryService';
import { getOrFetch, CACHE_KEYS, TTL } from '../../util/cache/sessionCache';

export function useBrowseLibraryData(userId) {
  const [continueWatching, setContinueWatching] = useState([]);
  const [recentlyAdded, setRecentlyAdded] = useState([]);
  const [recentlyWatched, setRecentlyWatched] = useState([]);
  const [watchlistPicks, setWatchlistPicks] = useState([]);
  const [stats, setStats] = useState({ watchingCount: 0, completedCount: 0, watchlistCount: 0 });
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const isBrowsePage = location.pathname === '/';

  useEffect(() => {
    if (!userId || !isBrowsePage) {
      return;
    }

    let active = true;
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const cacheKey = CACHE_KEYS.BROWSE_LIBRARY(userId);
        
        // Fetch all library items once
        const allItems = await getOrFetch({
          key: cacheKey,
          ttl: TTL.BROWSE_LIBRARY,
          fetcher: async () => {
            return await getAllLibraryItems(userId, {
              hydrate: false // No TMDB hydration
            });
          }
        });

        if (!active) return;

        // 1. Derive Continue Watching: watchStatus === 'watching'
        const watchingItems = (allItems || []).filter(item => {
          const status = item.tracking?.watchStatus ?? item.watchStatus ?? item.status;
          return status === 'watching';
        });

        // TV-first sort, then order by updatedAt descending
        const sortedWatching = [...watchingItems].sort((left, right) => {
          const isLeftTV = left.mediaType === 'tv' || left.media_type === 'tv';
          const isRightTV = right.mediaType === 'tv' || right.media_type === 'tv';

          if (isLeftTV && !isRightTV) return -1;
          if (!isLeftTV && isRightTV) return 1;

          const leftTime = left.tracking?.updatedAt?.toMillis ? left.tracking.updatedAt.toMillis() : new Date(left.tracking?.updatedAt || 0).getTime();
          const rightTime = right.tracking?.updatedAt?.toMillis ? right.tracking.updatedAt.toMillis() : new Date(right.tracking?.updatedAt || 0).getTime();
          return rightTime - leftTime;
        });

        // 2. Derive Recently Added: sort by addedAt descending
        const sortedRecentlyAdded = [...(allItems || [])].sort((left, right) => {
          const leftTime = left.tracking?.addedAt?.toMillis ? left.tracking.addedAt.toMillis() : new Date(left.tracking?.addedAt || left.tracking?.updatedAt || 0).getTime();
          const rightTime = right.tracking?.addedAt?.toMillis ? right.tracking.addedAt.toMillis() : new Date(right.tracking?.addedAt || right.tracking?.updatedAt || 0).getTime();
          return rightTime - leftTime;
        });

        // 3. Derive Recently Watched: filter items with valid lastWatchedAt, sort descending
        const watchedItems = (allItems || []).filter(item => {
          return !!(item.tracking?.lastWatchedAt || item.lastWatchedAt);
        });

        const sortedRecentlyWatched = [...watchedItems].sort((left, right) => {
          const leftVal = left.tracking?.lastWatchedAt || left.lastWatchedAt;
          const rightVal = right.tracking?.lastWatchedAt || right.lastWatchedAt;

          const leftTime = leftVal?.toMillis ? leftVal.toMillis() : new Date(leftVal || 0).getTime();
          const rightTime = rightVal?.toMillis ? rightVal.toMillis() : new Date(rightVal || 0).getTime();
          return rightTime - leftTime;
        });

        // 4. Derive Watchlist Picks: filter items with watchStatus === 'plan_to_watch', sort descending by score
        const watchlistItems = (allItems || []).filter(item => {
          const status = item.tracking?.watchStatus ?? item.watchStatus ?? item.status;
          return status === 'plan_to_watch';
        });

        const getMediaScore = (item) => {
          return Number(item.ratings?.imdbScore ?? item.sort?.imdbRating ?? item.ratings?.tmdbScore ?? 0);
        };

        const sortedWatchlistPicks = [...watchlistItems].sort((left, right) => {
          const scoreDiff = getMediaScore(right) - getMediaScore(left);
          if (scoreDiff !== 0) return scoreDiff;

          // Tie-breaker: addedAt desc
          const leftTime = left.tracking?.addedAt?.toMillis ? left.tracking.addedAt.toMillis() : new Date(left.tracking?.addedAt || left.tracking?.updatedAt || 0).getTime();
          const rightTime = right.tracking?.addedAt?.toMillis ? right.tracking.addedAt.toMillis() : new Date(right.tracking?.addedAt || right.tracking?.updatedAt || 0).getTime();
          return rightTime - leftTime;
        });

        // 5. Compute Count Statistics
        const computedStats = {
          watchingCount: watchingItems.length,
          completedCount: (allItems || []).filter(item => {
            const status = item.tracking?.watchStatus ?? item.watchStatus ?? item.status;
            return status === 'completed';
          }).length,
          watchlistCount: watchlistItems.length,
        };

        setContinueWatching(sortedWatching.slice(0, 15));
        setRecentlyAdded(sortedRecentlyAdded.slice(0, 15));
        setRecentlyWatched(sortedRecentlyWatched.slice(0, 15));
        setWatchlistPicks(sortedWatchlistPicks.slice(0, 15));
        setStats(computedStats);

      } catch (err) {
        console.error('Failed to fetch browse library items:', err);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    fetchDashboardData();
    return () => { active = false; };
  }, [userId, isBrowsePage]);

  return { continueWatching, recentlyAdded, recentlyWatched, watchlistPicks, stats, loading };
}
