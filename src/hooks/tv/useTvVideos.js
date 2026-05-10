import { useState, useEffect } from 'react';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_KEY;

/**
 * Hook to fetch videos/trailers for a TV show directly from TMDB
 * @param {string|number} tvId - The TMDB TV show ID
 * @returns {Object} { data, loading, error, refetch }
 */
const useTvVideos = (tvId) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchVideos = async () => {
    if (!tvId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const url = `https://api.themoviedb.org/3/tv/${tvId}/videos`;
      const response = await fetch(url, {
        headers: {
          accept: 'application/json',
          Authorization: `Bearer ${TMDB_API_KEY}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch TV videos: ${response.status}`);
      }

      const tmdbData = await response.json();
      
      // Normalize to our expected shape
      const videos = tmdbData.results?.map(v => ({
        id: v.id,
        key: v.key,
        name: v.name,
        site: v.site,
        type: v.type,
        official: v.official,
      })) || [];
      
      setData(videos);
    } catch (err) {
      console.error('Error in useTvVideos:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, [tvId]);

  return {
    data,
    loading,
    error,
    refetch: fetchVideos,
  };
};

export default useTvVideos;
