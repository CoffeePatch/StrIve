import { useCallback, useEffect, useState } from "react";
import { auth } from "../../util/firebase/firebase";

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
      const user = auth.currentUser;
      if (!user) throw new Error("unauthenticated");
      const token = await user.getIdToken();

      // Lightweight check against user preferences endpoint
      const prefRes = await fetch("/api/user/preferences", {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (prefRes.ok) {
        next.libraryItems = {
          ok: true,
          message: "PostgreSQL API reachable (User Service)",
        };
        next.seriesProgress = {
          ok: true,
          message: "PostgreSQL Database connected",
        };
      } else {
        next.libraryItems = {
          ok: false,
          message: `HTTP ${prefRes.status} on preferences endpoint`,
        };
        next.seriesProgress = {
          ok: false,
          message: `HTTP ${prefRes.status} on preferences endpoint`,
        };
      }
    } catch (err) {
      const errMessage = formatError(err);
      next.libraryItems = { ok: false, message: errMessage };
      next.seriesProgress = { ok: false, message: errMessage };
    }

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("unauthenticated");
      const token = await user.getIdToken();

      const res = await fetch("/api/tracking/watch", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ titleKey: "invalid", seasonNumber: 0, episodeNumber: 0, mode: "single" })
      });

      const status = res.status;
      const acceptable = [400, 404, 500];

      if (acceptable.includes(status)) {
        next.callable = {
          ok: true,
          message: `Tracking endpoint reachable (HTTP ${status})`,
        };
      } else {
        next.callable = {
          ok: false,
          message: `Unexpected HTTP status: ${status}`,
        };
      }
    } catch (err) {
      next.callable = {
        ok: false,
        message: formatError(err),
      };
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
