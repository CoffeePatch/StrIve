import React from 'react';
import { Star, Users, RotateCcw, Film, User } from 'lucide-react';

const RatingSection = ({ ratings = {}, loading = false, fallbackRatings = {} }) => {
  // Helper function to format vote counts
  const formatVoteCount = (count) => {
    if (!count || count === 'N/A') return 'N/A';
    
    const number = parseInt(count.replace(/,/g, ''), 10);
    if (isNaN(number)) return count;
    
    if (number >= 1000000) {
      return `${(number / 1000000).toFixed(1)}M`;
    } else if (number >= 1000) {
      return `${(number / 1000).toFixed(1)}K`;
    }
    return number.toString();
  };

  // Helper function to extract numeric value from ratings
  const extractNumericValue = (rating, type) => {
    if (!rating || rating === 'N/A') return 'N/A';
    
    switch (type) {
      case 'imdb':
        // Extract value from format like "8.1/10"
        return rating.match(/^(\d+\.?\d*)\/(\d+)/) ? `${rating.match(/^(\d+\.?\d*)\/(\d+)/)[1]}/10` : rating;
      case 'rt': // Rotten Tomatoes
        // Extract percentage from format like "85%"
        return rating.replace('%', '');
      case 'mc': // Metacritic
        // Extract score from format like "72/100"
        return rating.match(/^(\d+)\/(\d+)/) ? `${rating.match(/^(\d+)\/(\d+)/)[1]}/100` : rating;
      default:
        return rating;
    }
  };

  // Individual rating item component
  const RatingItem = ({ icon, title, value, subtitle, source, isLoading }) => {
    if (isLoading) {
      return (
        <div className="bg-gray-800 rounded-xl p-4 flex flex-col items-center justify-center h-32">
          <div className="animate-pulse flex flex-col items-center">
            <div className="rounded-full bg-gray-700 h-10 w-10 mb-2"></div>
            <div className="h-4 bg-gray-700 rounded w-3/4 mb-1"></div>
            <div className="h-3 bg-gray-700 rounded w-1/2"></div>
          </div>
        </div>
      );
    }

    if (!value || value === 'N/A') {
      return (
        <div className="bg-gray-800 rounded-xl p-4 flex flex-col items-center justify-center h-32 opacity-60">
          <div className="text-gray-400 mb-1">N/A</div>
          <div className="text-xs text-gray-500">{title}</div>
        </div>
      );
    }

    return (
      <div className="bg-gray-800 rounded-xl p-4 flex flex-col items-center justify-center h-32 hover:bg-gray-700 transition-colors">
        <div className="text-blue-400 mb-1">
          {icon && React.createElement(icon, { size: 24 })}
        </div>
        <div className="text-white text-lg font-bold mb-1">{value}</div>
        <div className="text-gray-400 text-sm mb-1">{title}</div>
        {subtitle && (
          <div className="text-gray-500 text-xs">{subtitle}</div>
        )}
        {source && (
          <div className="text-xs mt-1 px-2 py-0.5 bg-gray-700 rounded-full text-gray-300">
            {source}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full">
      <h3 className="text-xl font-bold text-white mb-4">Ratings & Reviews</h3>
      
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* IMDb Rating */}
        <RatingItem
          icon={Star}
          title="IMDb"
          value={ratings.imdbRating ? extractNumericValue(ratings.imdbRating, 'imdb') : 'N/A'}
          subtitle="/10"
          source={ratings.imdbRating ? ratings.source : null}
          isLoading={loading}
        />
        
        {/* IMDb Votes */}
        <RatingItem
          icon={Users}
          title="Votes"
          value={ratings.imdbVotes ? formatVoteCount(ratings.imdbVotes) : 'N/A'}
          subtitle="votes"
          source={ratings.imdbVotes ? ratings.source : null}
          isLoading={loading}
        />
        
        {/* TMDB Rating */}
        <RatingItem
          icon={Film}
          title="TMDB"
          value={ratings.tmdbRating ? `${ratings.tmdbRating}/10` : 
                 (ratings.vote_average ? `${ratings.vote_average.toFixed(1)}/10` : 'N/A')}
          source={ratings.tmdbRating ? 'tmdb' : 
                 ratings.vote_average ? 'tmdb' : 
                 (fallbackRatings && fallbackRatings.tmdb ? 'fallback' : null)}
          isLoading={loading}
        />
        
        {/* Rotten Tomatoes */}
        <RatingItem
          icon={RotateCcw}
          title="RT"
          value={ratings.rottenTomatoesRating ? extractNumericValue(ratings.rottenTomatoesRating, 'rt') : 'N/A'}
          subtitle="%"
          source={ratings.rottenTomatoesRating ? ratings.source : null}
          isLoading={loading}
        />
        
        {/* Metacritic */}
        <RatingItem
          icon={User}
          title="MC"
          value={ratings.metacriticRating ? extractNumericValue(ratings.metacriticRating, 'mc') : 'N/A'}
          subtitle="/100"
          source={ratings.metacriticRating ? ratings.source : null}
          isLoading={loading}
        />
      </div>
      
      {/* Rating source indicator */}
      {ratings.source && !loading && (
        <div className="mt-4 text-center">
          <span className={`inline-block px-3 py-1 rounded-full text-xs ${
            ratings.source === 'cache'
              ? 'bg-blue-900 text-blue-200' 
              : 'bg-gray-700 text-gray-200'
          }`}>
            Data from {ratings.source === 'cache' ? 'Cache' : 'TMDB'}
          </span>
        </div>
      )}
    </div>
  );
};

export default RatingSection;