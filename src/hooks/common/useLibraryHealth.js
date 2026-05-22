import { useCallback, useEffect, useState } from "react";
import {
  collection,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  limit,
  query,
} from "firebase/firestore";
import { db, auth } from "../../util/firebase/firebase";

const CALLABLE_NAME = "markEpisodeWatched";

const formatError = (err) => {
  if (!err) return "Unknown error";
  if (typeof err.details === "string" && err.details.trim()) return err.details;
  if (typeof err.message === "string" && err.message.trim()) return err.message;
  if (typeof err.code === "string" && err.code.trim()) return err.code;
  return String(err);
};

export const useLibraryHealth = (userId) => {
  const [loading, setLoading] = useState(false);
  const [lastRunAt, setLastRunAt] = useState(null);
  const [checks, setChecks] = useState({
    libraryItems: { ok: false, message: "Not checked", count: 0 },
    seriesProgress: { ok: false, message: "Not checked", count: 0 },
    callable: { ok: false, message: "Not checked" },
  });

  const runChecks = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    const next = {
      libraryItems: { ok: false, message: "Checking...", count: 0 },
      seriesProgress: { ok: false, message: "Checking...", count: 0 },
      callable: { ok: false, message: "Checking..." },
    };

    try {
      const libraryRef = collection(db, "users", userId, "library_items");
      const countSnap = await getCountFromServer(libraryRef);
      const count = countSnap.data().count || 0;

      const sampleSnap = await getDocs(query(libraryRef, limit(1)));
      next.libraryItems = {
        ok: true,
        count,
        message: sampleSnap.empty
          ? "Collection is reachable (currently empty)"
          : "Collection is reachable and contains data",
      };
    } catch (err) {
      next.libraryItems = {
        ok: false,
        count: 0,
        message: formatError(err),
      };
    }

    try {
      const progressRef = collection(db, "users", userId, "series_progress");
      const countSnap = await getCountFromServer(progressRef);
      const count = countSnap.data().count || 0;
      const sampleSnap = await getDocs(query(progressRef, limit(1)));

      next.seriesProgress = {
        ok: true,
        count,
        message: sampleSnap.empty
          ? "Collection is reachable (currently empty)"
          : "Collection is reachable and contains data",
      };
    } catch (err) {
      next.seriesProgress = {
        ok: false,
        count: 0,
        message: formatError(err),
      };
    }

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("unauthenticated");
      const token = await user.getIdToken();

      const res = await fetch("/api/markEpisodeWatched", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ titleKey: "invalid", seasonNumber: 0, episodeNumber: 0, mode: "single" })
      });

      if (res.ok) {
        next.callable = {
          ok: false,
          message: "Callable returned success for invalid payload (unexpected).",
        };
      } else {
        const status = res.status;
        const acceptable = [400, 404, 500];

        if (acceptable.includes(status)) {
          next.callable = {
            ok: true,
            message: `Callable reachable (HTTP ${status})`,
          };
        } else {
          next.callable = {
            ok: false,
            message: `Unexpected HTTP status: ${status}`,
          };
        }
      }
    } catch (err) {
      next.callable = {
        ok: false,
        message: formatError(err),
      };
    }

    // Optional direct read sanity check for a known migration report path.
    try {
      await getDoc(doc(db, "users", userId, "migration", "v2"));
    } catch {
      // Non-fatal for health panel.
    }

    setChecks(next);
    setLastRunAt(new Date().toISOString());
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (userId) runChecks();
  }, [userId, runChecks]);

  return {
    loading,
    checks,
    lastRunAt,
    runChecks,
  };
};

export default useLibraryHealth;
