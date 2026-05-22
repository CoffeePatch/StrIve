import { useState, useEffect } from 'react';

/**
 * Hook to fetch episodes for a specific season from our Vercel backend
 * @param {string|number} tvId - The TMDB TV show ID
 * @param {number} seasonNumber - The season number
 * @returns {Object} { data, loading, error, refetch }
 */
const useTvSeasonEpisodes = (tvId, seasonNumber) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchEpisodes = async () => {
    if (!tvId || seasonNumber === null || seasonNumber === undefined) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const url = `/api/tv/episodes?tvId=${tvId}&season=${seasonNumber}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch season episodes: ${response.status}`);
      }

      const normalized = await response.json();
      
      setData(normalized);
    } catch (err) {
      console.error('Error in useTvSeasonEpisodes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEpisodes();
  }, [tvId, seasonNumber]);

  return {
    data,
    loading,
    error,
    refetch: fetchEpisodes,
  };
};

export default useTvSeasonEpisodes;
