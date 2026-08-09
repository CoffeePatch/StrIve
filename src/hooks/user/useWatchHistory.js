import { useState, useEffect, useCallback } from "react";
import useRequireAuth from "../common/useRequireAuth";
import { userAdapter } from "../../domain/user/userAdapter";

export const useWatchHistory = (options = {}) => {
  const user = useRequireAuth();
  const limit = options.limit || 50;

  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  const fetchHistory = useCallback(async (isInitial = true) => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      if (isInitial) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      const offset = isInitial ? 0 : (nextCursor || 0);
      const data = await userAdapter.fetchWatchHistory(user.uid, {
        limit,
        offset,
        forceRefresh: isInitial
      });

      const fetchedItems = data?.items || [];
      const newNextCursor = data?.nextCursor ?? null;

      if (isInitial) {
        setItems(fetchedItems);
      } else {
        setItems(prev => [...prev, ...fetchedItems]);
      }
      setNextCursor(newNextCursor);
    } catch (err) {
      console.error("Error fetching watch history:", err);
      setError(err.message || "Failed to load watch history");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [user, limit, nextCursor]);

  useEffect(() => {
    fetchHistory(true);
  }, [user]);

  const loadMore = useCallback(() => {
    if (!loadingMore && nextCursor !== null) {
      fetchHistory(false);
    }
  }, [fetchHistory, loadingMore, nextCursor]);

  const refreshHistory = useCallback(() => {
    return fetchHistory(true);
  }, [fetchHistory]);

  return {
    items,
    nextCursor,
    hasMore: nextCursor !== null,
    loading,
    loadingMore,
    error,
    loadMore,
    refreshHistory
  };
};

export default useWatchHistory;
