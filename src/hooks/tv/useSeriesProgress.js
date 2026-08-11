import { useEffect, useMemo, useState, useCallback } from "react";
import { auth } from "../../util/firebase/firebase";
import { getOrFetch, CACHE_KEYS, TTL } from "../../util/cache/sessionCache";

/**
 * Reads series progress doc from PostgreSQL API.
 */
export const useSeriesProgress = ({ userId, titleKey }) => {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(Boolean(userId && titleKey));
  const [error, setError] = useState(null);

  const fetchProgress = useCallback(async () => {
    if (!userId || !titleKey) {
      setProgress(null);
      setLoading(false);
      setError(null);
      return;
    }

    const tvId = titleKey.replace("tmdb_tv_", "");
    if (!tvId) return;

    try {
      setLoading(true);
      setError(null);

      const data = await getOrFetch({
        key: CACHE_KEYS.TV_DETAILS(tvId),
        ttl: TTL.TV_DETAILS,
        fetcher: async () => {
          const user = auth.currentUser;
          const token = user ? await user.getIdToken() : null;
          const res = await fetch(`/api/catalog/${titleKey}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        }
      });

      setProgress(data?.progress || null);
    } catch (err) {
      console.error("useSeriesProgress fetch error:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [userId, titleKey]);

  useEffect(() => {
    fetchProgress();
  }, [fetchProgress]);

  const derived = useMemo(() => {
    if (!progress) {
      return {
        watchedEpisodesCount: 0,
        airedEpisodesCount: 0,
        completionRatioAired: 0,
      };
    }

    const watchedEpisodesCount = Number(progress.watchedEpisodesCount || 0);
    const airedEpisodesCount = Number(progress.airedEpisodesCount || 0);
    const completionRatioAired = Math.max(
      0,
      Math.min(1, Number(progress.completionRatioAired || 0))
    );

    return {
      watchedEpisodesCount,
      airedEpisodesCount,
      completionRatioAired,
    };
  }, [progress]);

  return {
    progress,
    loading,
    error,
    fetchProgress,
    ...derived,
  };
};

export default useSeriesProgress;
