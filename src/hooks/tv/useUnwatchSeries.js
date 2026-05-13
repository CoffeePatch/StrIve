import { useCallback, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../../util/firebase/firebase";

const UNWATCH_SERIES_FN = "unwatchSeries";

const toErrorMessage = (error) => {
  if (!error) return "Unknown error";
  if (typeof error.details === "string" && error.details.trim()) return error.details;
  if (typeof error.message === "string" && error.message.trim()) return error.message;
  return String(error);
};

/**
 * Calls the unwatchSeries callable to reset all episode watch states for a show.
 */
export const useUnwatchSeries = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const unwatchSeries = useCallback(async ({ titleKey }) => {
    setLoading(true);
    setError(null);

    try {
      const callable = httpsCallable(functions, UNWATCH_SERIES_FN);
      const response = await callable({ titleKey });
      return response?.data || null;
    } catch (err) {
      const message = toErrorMessage(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    unwatchSeries,
    loading,
    error,
    clearError: () => setError(null),
  };
};

export default useUnwatchSeries;
