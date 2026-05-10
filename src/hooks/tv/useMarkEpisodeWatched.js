import { useCallback, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../util/firebase";

const MARK_EPISODE_WATCHED_FN = "markEpisodeWatched";

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
      const callable = httpsCallable(functions, MARK_EPISODE_WATCHED_FN);

      const requestId = `${titleKey}_${seasonNumber}_${episodeNumber}_${mode}_${Date.now()}`;
      const response = await callable({
        titleKey,
        seasonNumber,
        episodeNumber,
        mode,
        requestId,
        episodeCatalog,
      });

      return response?.data || null;
    } catch (err) {
      const message = toErrorMessage(err);
      const routing = String(import.meta.env.VITE_USE_FUNCTIONS_EMULATOR || "").toLowerCase() === "true"
        ? `emulator:${import.meta.env.VITE_FUNCTIONS_EMULATOR_HOST || "127.0.0.1"}:${import.meta.env.VITE_FUNCTIONS_EMULATOR_PORT || 5101}`
        : `cloud:${import.meta.env.VITE_FIREBASE_FUNCTIONS_REGION || "us-central1"}`;
      const fullMessage = `[${routing}] ${message}`;
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
