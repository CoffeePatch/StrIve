import { useEffect, useState, useCallback } from "react";
import { auth } from "../../util/firebase/firebase";
import { getOrFetch, CACHE_KEYS, TTL } from "../../util/cache/sessionCache";

/**
 * Fetches watched episode state for a TV series from PostgreSQL API.
 * Returns a Set<string> of watched episodes keyed as "seasonNumber:episodeNumber".
 */
export const useEpisodeStates = ({ userId, titleKey }) => {
  const [watchedSet, setWatchedSet] = useState(new Set());
  const [loading, setLoading] = useState(Boolean(userId && titleKey));
  const [error, setError] = useState(null);

  const fetchStates = useCallback(async () => {
    if (!userId || !titleKey) {
      setWatchedSet(new Set());
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

      const catalog = data?.catalog || data;
      const newSet = new Set();

      if (catalog?.seasons) {
        catalog.seasons.forEach((season) => {
          if (season.episodes) {
            season.episodes.forEach((ep) => {
              if (ep.watched) {
                newSet.add(`${ep.seasonNumber}:${ep.episodeNumber}`);
              }
            });
          }
        });
      }

      setWatchedSet(newSet);
    } catch (err) {
      console.error("useEpisodeStates fetch error:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [userId, titleKey]);

  useEffect(() => {
    fetchStates();
  }, [fetchStates]);

  /** Optimistically add an episode to the watched set. */
  const markLocallyWatched = useCallback((seasonNumber, episodeNumber) => {
    setWatchedSet((prev) => {
      const next = new Set(prev);
      next.add(`${seasonNumber}:${episodeNumber}`);
      return next;
    });
  }, []);

  /** Optimistically add multiple episodes to the watched set. */
  const markLocallyWatchedBulk = useCallback((episodes = []) => {
    if (!Array.isArray(episodes) || episodes.length === 0) return;
    setWatchedSet((prev) => {
      const next = new Set(prev);
      episodes.forEach((ep) => {
        const s = Number(ep?.seasonNumber ?? ep?.season_number);
        const e = Number(ep?.episodeNumber ?? ep?.episode_number);
        if (Number.isInteger(s) && Number.isInteger(e)) {
          next.add(`${s}:${e}`);
        }
      });
      return next;
    });
  }, []);

  /** Optimistically clear all watched episodes. */
  const clearAllLocal = useCallback(() => {
    setWatchedSet(new Set());
  }, []);

  /** Rollback watched set to a previous state on sync failure */
  const rollbackLocal = useCallback((backupSet) => {
    setWatchedSet(new Set(backupSet));
  }, []);

  return { watchedSet, loading, error, fetchStates, markLocallyWatched, markLocallyWatchedBulk, clearAllLocal, rollbackLocal };
};

export default useEpisodeStates;
