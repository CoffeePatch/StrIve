import { useState, useEffect, useCallback } from 'react';
import { userAdapter } from '../../domain/user/userAdapter';

export const useUserAnalytics = (userId) => {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchAnalytics = useCallback(async (forceRefresh = false) => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await userAdapter.fetchUserAnalytics(userId, { forceRefresh });
      setAnalytics(data);
    } catch (err) {
      console.error("Failed to fetch user analytics:", err);
      setError(err.message || "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    analytics,
    loading,
    error,
    refetch: () => fetchAnalytics(true)
  };
};
