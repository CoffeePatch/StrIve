import { useState, useEffect, useRef } from 'react';
import { auth } from '../../util/firebase/firebase';

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
        const user = auth.currentUser;
        if (!user) throw new Error("unauthenticated");
        const token = await user.getIdToken();

        // Search using the BFF endpoint
        const response = await fetch(`/api/catalog/search?q=${encodeURIComponent(searchTerm)}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to fetch search results');
        }
        
        const data = await response.json();

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