import { useState, useEffect } from 'react';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_KEY;

/**
 * Hook to fetch episodes for a specific season directly from TMDB
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

      const url = `https://api.themoviedb.org/3/tv/${tvId}/season/${seasonNumber}`;
      const response = await fetch(url, {
        headers: {
          accept: 'application/json',
          Authorization: `Bearer ${TMDB_API_KEY}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch season episodes: ${response.status}`);
      }

      const tmdbData = await response.json();
      
      // Normalize to our expected shape
      const normalized = {
        seasonNumber: tmdbData.season_number,
        name: tmdbData.name,
        overview: tmdbData.overview,
        airDate: tmdbData.air_date,
        episodes: tmdbData.episodes?.map(ep => ({
          id: ep.id,
          name: ep.name,
          episodeNumber: ep.episode_number,
          seasonNumber: ep.season_number,
          overview: ep.overview,
          stillPath: ep.still_path,
          airDate: ep.air_date,
          runtime: ep.runtime,
          voteAverage: ep.vote_average,
          voteCount: ep.vote_count,
        })) || [],
      };
      
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
