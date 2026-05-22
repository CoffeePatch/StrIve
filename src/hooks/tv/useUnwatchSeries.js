import { useCallback, useState } from "react";
import { auth } from "../../util/firebase/firebase";

const UNWATCH_SERIES_ENDPOINT = "/api/unwatchSeries";

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
      const user = auth.currentUser;
      if (!user) throw new Error("unauthenticated");
      const token = await user.getIdToken();

      const res = await fetch(UNWATCH_SERIES_ENDPOINT, {
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
    unwatchSeries,
    loading,
    error,
    clearError: () => setError(null),
  };
};

export default useUnwatchSeries;
