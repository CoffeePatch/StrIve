import React from 'react';

const getRatingColor = (rating) => {
  if (!rating || rating === 0) return 'bg-gray-700 text-gray-400';
  if (rating >= 9.0) return 'bg-green-500 text-black';
  if (rating >= 8.0) return 'bg-lime-500 text-black';
  if (rating >= 7.0) return 'bg-yellow-400 text-black';
  if (rating >= 6.0) return 'bg-orange-500 text-black';
  if (rating >= 5.0) return 'bg-red-500 text-white';
  return 'bg-purple-500 text-white';
};

const EpisodeRatingBox = ({ rating, episodeNumber, seasonNumber, onClick }) => {
  const colorClasses = getRatingColor(rating);
  const displayRating = rating ? rating.toFixed(1) : '-';

  return (
    <div 
      className={`w-full h-full aspect-square flex items-center justify-center rounded-md font-bold text-sm transition-all hover:scale-105 cursor-pointer ${colorClasses}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Season ${seasonNumber} Episode ${episodeNumber}: Rating ${displayRating}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {displayRating}
    </div>
  );
};

export default EpisodeRatingBox;
