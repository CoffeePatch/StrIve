import { useState, useEffect } from 'react';

/**
 * Hook to fetch videos/trailers for a TV show from our Vercel backend
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

      const url = `/api/tv/videos?tvId=${tvId}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch TV videos: ${response.status}`);
      }

      const videos = await response.json();
      
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
