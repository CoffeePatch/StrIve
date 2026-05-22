import { useState, useEffect } from 'react';

/**
 * Hook to fetch TV show details from our Vercel backend
 * @param {string|number} tvId - The TMDB TV show ID
 * @returns {Object} { data, loading, error, refetch }
 */
const useTvShowDetails = (tvId) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDetails = async () => {
    if (!tvId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const url = `/api/tv/details?tvId=${tvId}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch TV show details: ${response.status}`);
      }

      const normalized = await response.json();
      
      setData(normalized);
    } catch (err) {
      console.error('Error in useTvShowDetails:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetails();
  }, [tvId]);

  return {
    data,
    loading,
    error,
    refetch: fetchDetails,
  };
};

export default useTvShowDetails;
