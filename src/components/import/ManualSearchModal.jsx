import React, { useState, useEffect, useRef } from 'react';
import { tmdbOptions } from '../../util/core/constants';

const ManualSearchModal = ({ 
  isOpen, 
  onClose, 
  initialQuery, 
  onSelectMovie 
}) => {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const inputRef = useRef(null);
  const debounceTimer = useRef(null);

  // Focus the input when the modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Debounced search function
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    const performSearch = async () => {
      setLoading(true);
      setError('');

      try {
        // Use TMDB search API
        const response = await fetch(
          `https://api.themoviedb.org/3/search/movie?query=${encodeURIComponent(searchQuery)}&include_adult=false&language=en-US&page=1`,
          tmdbOptions
        );

        if (!response.ok) {
          throw new Error(`TMDB API error: ${response.status}`);
        }

        const data = await response.json();
        setSearchResults(data.results || []);
      } catch (err) {
        console.error('Search error:', err);
        setError('Failed to search for movies. Please try again.');
        setSearchResults([]);
      } finally {
        setLoading(false);
      }
    };

    // Clear any existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set a new timer
    debounceTimer.current = setTimeout(() => {
      performSearch();
    }, 500); // 500ms debounce

    // Cleanup function
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [searchQuery]);

  // Handle movie selection
  const handleSelectMovie = (movie) => {
    onSelectMovie({
      id: movie.id,
      title: movie.title,
      release_date: movie.release_date,
      poster_path: movie.poster_path,
      tmdbId: movie.id
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white">Find Movie</h2>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          <div className="mb-4">
            <label htmlFor="searchInput" className="block text-sm font-medium text-gray-300 mb-2">
              Search for a movie
            </label>
            <input
              ref={inputRef}
              id="searchInput"
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Enter movie title..."
              className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-600"
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm mb-4">{error}</div>
          )}

          {loading && (
            <div className="flex justify-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
            </div>
          )}

          {!loading && searchResults.length > 0 && (
            <div className="max-h-96 overflow-y-auto">
              <h3 className="text-lg font-medium text-white mb-2">Search Results</h3>
              <div className="space-y-2">
                {searchResults.map((movie) => (
                  <div 
                    key={movie.id}
                    className="flex items-center p-3 bg-gray-800/50 rounded-lg hover:bg-gray-700/50 cursor-pointer"
                    onClick={() => handleSelectMovie(movie)}
                  >
                    {/* Poster */}
                    <div className="w-12 h-16 flex-shrink-0 mr-4">
                      {movie.poster_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w154${movie.poster_path}`}
                          alt={movie.title}
                          className="w-full h-full object-cover rounded"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.style.display = 'none';
                            const parent = e.target.parentElement;
                            const placeholder = document.createElement('div');
                            placeholder.className = 'w-full h-full bg-gray-700 rounded flex items-center justify-center';
                            placeholder.textContent = 'No Image';
                            parent.appendChild(placeholder);
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-gray-700 rounded flex items-center justify-center">
                          <span className="text-gray-400 text-xs">No Image</span>
                        </div>
                      )}
                    </div>
                    
                    {/* Movie Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-medium truncate">{movie.title}</h4>
                      <p className="text-gray-400 text-sm">
                        {movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}
                      </p>
                      {movie.overview && (
                        <p className="text-gray-500 text-sm truncate mt-1">{movie.overview}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!loading && searchQuery && searchResults.length === 0 && (
            <div className="text-gray-400 text-center py-4">
              No movies found for "{searchQuery}". Try a different search term.
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualSearchModal;