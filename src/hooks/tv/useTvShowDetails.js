import { useState, useEffect } from 'react';

const TMDB_API_KEY = import.meta.env.VITE_TMDB_KEY;

/**
 * Hook to fetch TV show details directly from TMDB
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

      const url = `https://api.themoviedb.org/3/tv/${tvId}?append_to_response=external_ids,images&include_image_language=en,null`;
      const response = await fetch(url, {
        headers: {
          accept: 'application/json',
          Authorization: `Bearer ${TMDB_API_KEY}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch TV show details: ${response.status}`);
      }

      const tmdbData = await response.json();
      
      // Normalize to our expected shape
      const normalized = {
        id: tmdbData.id,
        name: tmdbData.name,
        overview: tmdbData.overview,
        posterPath: tmdbData.poster_path,
        backdropPath: tmdbData.backdrop_path,
        firstAirDate: tmdbData.first_air_date,
        lastAirDate: tmdbData.last_air_date,
        status: tmdbData.status,
        numberOfSeasons: tmdbData.number_of_seasons,
        numberOfEpisodes: tmdbData.number_of_episodes,
        networks: tmdbData.networks?.map(n => ({ id: n.id, name: n.name, logoPath: n.logo_path })) || [],
        voteAverage: tmdbData.vote_average,
        voteCount: tmdbData.vote_count,
        logos: tmdbData.images?.logos?.map(l => ({ filePath: l.file_path, aspectRatio: l.aspect_ratio })) || [],
        imdbId: tmdbData.external_ids?.imdb_id || null,
        seasons: tmdbData.seasons || [],
      };
      
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
