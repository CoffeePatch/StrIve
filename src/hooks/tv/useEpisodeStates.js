import { useEffect, useState, useCallback } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../util/firebase/firebase";

/**
 * Realtime listener for all episode_states of a TV series.
 * Returns a Set<string> of watched episodes keyed as "seasonNumber:episodeNumber".
 *
 * Path: users/{uid}/episode_states where titleKey == {titleKey}
 */
export const useEpisodeStates = ({ userId, titleKey }) => {
  const [watchedSet, setWatchedSet] = useState(new Set());
  const [loading, setLoading] = useState(Boolean(userId && titleKey));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId || !titleKey) {
      setWatchedSet(new Set());
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    const colRef = collection(db, "users", userId, "episode_states");
    const q = query(colRef, where("titleKey", "==", titleKey));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const newSet = new Set();
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.state === "watched") {
            const s = Number(data.seasonNumber);
            const e = Number(data.episodeNumber);
            if (Number.isInteger(s) && Number.isInteger(e)) {
              newSet.add(`${s}:${e}`);
            }
          }
        });
        setWatchedSet(newSet);
        setLoading(false);
      },
      (err) => {
        console.error("useEpisodeStates snapshot error:", err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [userId, titleKey]);

  /** Optimistically add an episode to the watched set (before Firestore confirms). */
  const markLocallyWatched = useCallback((seasonNumber, episodeNumber) => {
    setWatchedSet((prev) => {
      const next = new Set(prev);
      next.add(`${seasonNumber}:${episodeNumber}`);
      return next;
    });
  }, []);

  /** Optimistically clear all watched episodes (for unwatch-series flow). */
  const clearAllLocal = useCallback(() => {
    setWatchedSet(new Set());
  }, []);

  return { watchedSet, loading, error, markLocallyWatched, clearAllLocal };
};

export default useEpisodeStates;
