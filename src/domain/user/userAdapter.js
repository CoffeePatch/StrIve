import { auth } from "../../util/firebase/firebase";
import { getOrFetch, CACHE_KEYS, TTL, sessionCache } from "../../util/cache/sessionCache";

async function getAuthHeader() {
  const user = auth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

export const userAdapter = {
  fetchWatchHistory: async (userId, options = {}) => {
    if (!userId) return { items: [], nextCursor: null };
    const { limit = 50, offset = 0, forceRefresh = false } = options;
    const headers = await getAuthHeader();

    const cacheKey = `watch_history_${userId}_${limit}_${offset}`;
    
    if (forceRefresh) {
      sessionCache.remove(cacheKey);
    }

    return getOrFetch({
      key: cacheKey,
      ttl: TTL.CONTINUE_WATCHING,
      fetcher: async () => {
        const response = await fetch(`/api/user/history?limit=${limit}&offset=${offset}`, {
          headers
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch watch history (${response.status})`);
        }

        return await response.json();
      }
    });
  },

  fetchUserAnalytics: async (userId, options = {}) => {
    if (!userId) return null;
    const { forceRefresh = false } = options;
    const headers = await getAuthHeader();
    const cacheKey = CACHE_KEYS.USER_ANALYTICS(userId);

    if (forceRefresh) {
      sessionCache.remove(cacheKey);
    }

    return getOrFetch({
      key: cacheKey,
      ttl: TTL.USER_ANALYTICS,
      fetcher: async () => {
        const response = await fetch(`/api/user/analytics`, { headers });
        if (!response.ok) {
          throw new Error(`Failed to fetch user analytics (${response.status})`);
        }
        return await response.json();
      }
    });
  }
};
