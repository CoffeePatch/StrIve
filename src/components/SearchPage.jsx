import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MovieCard from './MovieCard';
import useSearch from '../hooks/useSearch';
import { triggerGlobalRefetch } from '../hooks/useImdbRating';

const SearchPage = () => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefetching, setIsRefetching] = useState(false);

  React.useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    if (query) {
      setSearchTerm(query);
    }
  }, []);

  const { results, loading, error } = useSearch(searchTerm);

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    navigate('/search', { replace: true });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
  };

  const handleRefetchImdbRatings = () => {
    setIsRefetching(true);
    triggerGlobalRefetch();
    // Reset the refetching state after a short delay
    setTimeout(() => setIsRefetching(false), 2000);
  };

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate('/library');
  };

  return (
    <div className="min-h-screen premium-page pt-24">
      <div className="premium-container py-8">
        <div className="mb-6">
          <button
            type="button"
            onClick={handleGoBack}
            className="glass-effect hover:bg-white/10 text-white px-4 py-2 rounded-full transition-all flex items-center gap-2"
            aria-label="Go back"
          >
            <span className="material-symbols-outlined text-lg">arrow_back</span>
            <span className="font-secondary text-sm">Back</span>
          </button>
        </div>

        <div className="mb-12 text-center">
          <div className="flex justify-center mb-4">
            <span className="material-symbols-outlined text-7xl gradient-accent">
              search
            </span>
          </div>
          <h1 className="font-display text-6xl font-bold gradient-text mb-4">
            Discover
          </h1>
          <p className="text-white/60 font-secondary text-lg">
            Find your next favorite movie or TV show
          </p>
        </div>

        <div className="max-w-3xl mx-auto mb-16">
          <form onSubmit={handleSubmit} className="relative">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-white/40 text-3xl">
                search
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={handleInputChange}
                placeholder="Search for movies, TV shows, actors..."
                className="w-full pl-20 pr-16 py-6 glass-effect text-white text-lg rounded-2xl border border-white/10 focus:outline-none focus:border-red-600 focus:bg-white/10 transition-all placeholder-white/40 font-secondary"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  className="absolute right-4 top-1/2 -translate-y-1/2 glass-effect hover:bg-white/20 text-white rounded-full p-2 transition-all"
                  aria-label="Clear search"
                >
                  <span className="material-symbols-outlined">close</span>
                </button>
              )}
            </div>
          </form>
        </div>

        {searchTerm && (
          <div className="mb-16">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
              <h3 className="text-2xl lg:text-3xl font-bold text-white font-secondary">
                Results for <span className="gradient-accent">"{searchTerm}"</span>
              </h3>
              <div className="flex items-center gap-3">
                <div className="glass-effect px-4 py-2 rounded-full">
                  <p className="text-white/80 font-secondary text-sm">
                    <span className="font-bold text-red-400">{results.length}</span> {results.length === 1 ? 'result' : 'results'} found
                  </p>
                </div>
                {results.length > 0 && (
                  <button
                    onClick={handleRefetchImdbRatings}
                    disabled={isRefetching}
                    className="glass-effect hover:bg-white/10 text-white px-4 py-2 rounded-full transition-all flex items-center gap-2 disabled:opacity-50 border border-yellow-500/30 hover:border-yellow-500/50"
                    title="Reload missing IMDb ratings"
                  >
                    <span className={`material-symbols-outlined text-yellow-400 ${isRefetching ? 'animate-spin' : ''}`}>
                      {isRefetching ? 'progress_activity' : 'refresh'}
                    </span>
                    <span className="text-sm font-secondary font-medium">
                      {isRefetching ? 'Reloading...' : 'Reload IMDb'}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {error && (
              <div className="text-center py-12 glass-effect rounded-2xl">
                <span className="material-symbols-outlined text-6xl text-red-400 mb-4">
                  error
                </span>
                <p className="text-red-400 text-lg font-secondary">Error: {error}</p>
              </div>
            )}

            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {[...Array(10)].map((_, index) => (
                  <div key={index} className="glass-effect rounded-2xl overflow-hidden animate-pulse">
                    <div className="w-full h-80 bg-white/5"></div>
                    <div className="p-4">
                      <div className="h-4 bg-white/5 rounded mb-2"></div>
                      <div className="h-3 bg-white/5 rounded w-2/3"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : results.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                {results.map((result) => {
                  const mediaType = result.media_type;
                  const movie = {
                    id: result.id,
                    poster_path: result.poster_path,
                    title: result.title,
                    name: result.name,
                    original_title: result.title || result.name,
                    release_date: result.release_date,
                    first_air_date: result.first_air_date,
                    vote_average: result.vote_average,
                    media_type: mediaType
                  };

                  return <MovieCard key={result.id} movie={movie} />;
                })}
              </div>
            ) : (
              <div className="text-center py-16 glass-effect rounded-2xl">
                <span className="material-symbols-outlined text-7xl text-white/30 mb-4">
                  search_off
                </span>
                <p className="text-white/60 text-xl font-secondary">No results found for your query</p>
                <p className="text-white/40 text-sm font-secondary mt-2">Try different keywords or check your spelling</p>
              </div>
            )}
          </div>
        )}

        {!searchTerm && (
          <div className="text-center py-16">
            <div className="mb-8 flex justify-center">
              <div className="glass-effect p-8 rounded-full">
                <span className="material-symbols-outlined text-8xl gradient-accent">
                  travel_explore
                </span>
              </div>
            </div>
            <h2 className="text-3xl font-bold text-white mb-4 font-display">
              Start Your Journey
            </h2>
            <p className="text-white/60 text-lg font-secondary max-w-md mx-auto">
              Enter a search term above to discover amazing movies and TV shows
            </p>
            
            <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-2xl mx-auto">
              {['Action', 'Comedy', 'Drama', 'Sci-Fi'].map((genre) => (
                <button
                  key={genre}
                  onClick={() => setSearchTerm(genre)}
                  className="glass-effect hover:bg-white/10 text-white px-6 py-3 rounded-xl transition-all hover:scale-105 font-secondary font-medium"
                >
                  {genre}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;