import { useCallback, useState } from "react";
import { auth } from "../../util/firebase/firebase";

const MARK_EPISODE_WATCHED_ENDPOINT = "/api/tracking/watch";

const toErrorMessage = (error) => {
  if (!error) return "Unknown error";
  if (typeof error.details === "string" && error.details.trim()) return error.details;
  if (typeof error.code === "string" && error.code.trim() && typeof error.message === "string" && error.message.trim()) {
    return `${error.code}: ${error.message}`;
  }
  if (typeof error.message === "string" && error.message.trim()) return error.message;
  if (typeof error.code === "string" && error.code.trim()) return error.code;
  return String(error);
};

/**
 * Calls the markEpisodeWatched callable with loading/error state.
 */
export const useMarkEpisodeWatched = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const markEpisodeWatched = useCallback(async ({ titleKey, seasonNumber, episodeNumber, mode, episodeCatalog = [] }) => {
    setLoading(true);
    setError(null);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("unauthenticated");
      const token = await user.getIdToken();

      const requestId = `${titleKey}_${seasonNumber}_${episodeNumber}_${mode}_${Date.now()}`;
      
      const res = await fetch(MARK_EPISODE_WATCHED_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          titleKey,
          seasonNumber,
          episodeNumber,
          mode,
          requestId,
          episodeCatalog,
        })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      return data;
    } catch (err) {
      const message = toErrorMessage(err);
      const fullMessage = `[api] ${message}`;
      setError(fullMessage);
      throw new Error(fullMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    markEpisodeWatched,
    loading,
    error,
    clearError: () => setError(null),
  };
};

export default useMarkEpisodeWatched;
