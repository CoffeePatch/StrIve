import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../util/firebase";

/**
 * Reads a single denormalized progress doc for a TV series.
 * Path: users/{uid}/series_progress/{titleKey}
 */
export const useSeriesProgress = ({ userId, titleKey, realtime = true }) => {
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(Boolean(userId && titleKey));
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId || !titleKey) {
      setProgress(null);
      setLoading(false);
      setError(null);
      return;
    }

    const ref = doc(db, "users", userId, "series_progress", titleKey);
    setLoading(true);
    setError(null);

    if (realtime) {
      const unsub = onSnapshot(
        ref,
        (snap) => {
          setProgress(snap.exists() ? { id: snap.id, ...snap.data() } : null);
          setLoading(false);
        },
        (err) => {
          setError(err);
          setLoading(false);
        }
      );
      return () => unsub();
    }

    getDoc(ref)
      .then((snap) => {
        setProgress(snap.exists() ? { id: snap.id, ...snap.data() } : null);
      })
      .catch((err) => setError(err))
      .finally(() => setLoading(false));
  }, [userId, titleKey, realtime]);

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
    ...derived,
  };
};

export default useSeriesProgress;
