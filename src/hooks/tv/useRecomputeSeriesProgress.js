import { useCallback, useState } from "react";
import { auth } from "../../util/firebase/firebase";

const RECOMPUTE_SERIES_PROGRESS_ENDPOINT = "/api/recomputeSeriesProgress";

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
 * Calls recomputeSeriesProgress callable with loading/error state.
 */
export const useRecomputeSeriesProgress = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const recomputeSeriesProgress = useCallback(async ({ titleKey }) => {
    setLoading(true);
    setError(null);

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("unauthenticated");
      const token = await user.getIdToken();

      const res = await fetch(RECOMPUTE_SERIES_PROGRESS_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ titleKey })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || errData.error || \`HTTP \${res.status}\`);
      }

      const data = await res.json();
      return data;
    } catch (err) {
      const message = toErrorMessage(err);
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    recomputeSeriesProgress,
    loading,
    error,
    clearError: () => setError(null),
  };
};

export default useRecomputeSeriesProgress;
