import { useState, useEffect } from 'react';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_KEY;

/**
 * Hook to fetch similar TV shows from TMDB
 * @param {string|number} tvId - The TMDB TV show ID
 * @returns {Object} { data, loading, error }
 */
const useSimilarShows = (tvId) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSimilarShows = async () => {
      if (!tvId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const url = `https://api.themoviedb.org/3/tv/${tvId}/similar?page=1`;
        const response = await fetch(url, {
          headers: {
            accept: 'application/json',
            Authorization: `Bearer ${TMDB_API_KEY}`,
          },
        });
        
        if (!response.ok) {
          throw new Error(`Failed to fetch similar shows: ${response.status}`);
        }

        const tmdbData = await response.json();
        
        // Normalize and return all results from the first page (no hard slice limit)
        const shows = (tmdbData.results || []).map(show => ({
          id: show.id,
          name: show.name,
          posterPath: show.poster_path,
          voteAverage: show.vote_average,
          firstAirDate: show.first_air_date,
        }));
        
        setData(shows);
      } catch (err) {
        console.error('Error in useSimilarShows:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSimilarShows();
  }, [tvId]);

  return {
    data,
    loading,
    error,
  };
};

export default useSimilarShows;
