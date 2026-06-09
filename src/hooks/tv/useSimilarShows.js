import { useState, useEffect } from 'react';
import tmdbApiService from '../../services/tmdb/tmdbApiService';

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

        const tmdbData = await tmdbApiService.get(`/tv/${tvId}/similar`, { page: 1 });
        
        if (!tmdbData) {
          throw new Error('Failed to fetch similar shows');
        }
        
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
