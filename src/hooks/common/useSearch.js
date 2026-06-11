import { useState, useEffect, useRef } from 'react';
import tmdbApiService from '../../services/tmdb/tmdbApiService';

const useSearch = (searchTerm) => {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Create a ref to store the timeout ID
  const timeoutRef = useRef(null);

  useEffect(() => {
    // Clear the previous timeout if it exists
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // If searchTerm is empty, clear results
    if (!searchTerm) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    // Set a new timeout for 500ms
    timeoutRef.current = setTimeout(async () => {
      try {

        // Search using TMDB API with images via proxy
        const data = await tmdbApiService.get('/search/multi', {
          query: searchTerm,
          language: 'en-US',
          include_image_language: 'en,null',
        });

        if (!data || !data.results) {
          throw new Error('Failed to fetch search results');
        }

        // Filter results to separate movies and TV shows
        const searchResults = data.results.filter(item => 
          item.media_type !== 'person' // Exclude person results
        );

        setResults(searchResults);
      } catch (err) {
        setError(err.message);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 500);

    // Cleanup function to clear timeout when component unmounts or when searchTerm changes
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [searchTerm]);

  return { results, loading, error };
};

export default useSearch;