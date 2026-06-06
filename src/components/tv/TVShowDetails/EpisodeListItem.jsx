import React from "react";
import { Star, Clock, Check } from "lucide-react";

const IMG_CDN_URL = "https://image.tmdb.org/t/p";

const EpisodeListItem = ({ episode, onClick, isWatched = false, onToggleWatched, watchLoading = false }) => {
  const handleWatchedClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onToggleWatched && !watchLoading) {
      onToggleWatched(episode);
    }
  };

  return (
    <div
      onClick={onClick}
      className={`group flex flex-col sm:flex-row gap-4 sm:gap-6 py-5 border-b border-white/10 cursor-pointer transition-colors hover:bg-white/[0.02] px-2 sm:px-4 ${isWatched ? 'opacity-60' : ''}`}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`Play ${episode.name}, Episode ${episode.episodeNumber}`}
    >
      {/* Thumbnail */}
      <div className="relative flex-shrink-0 w-full sm:w-56 lg:w-64 rounded-[8px] overflow-hidden aspect-[16/9] bg-[#1A1A1A]">
        {episode.stillPath ? (
          <img
            src={`${IMG_CDN_URL}/w300${episode.stillPath}`}
            alt={episode.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">
            No Image
          </div>
        )}
        {isWatched && (
          <div className="absolute inset-0 bg-black/50 pointer-events-none flex items-center justify-center">
            <div className="bg-black/60 rounded-full p-2">
              <Check className="w-6 h-6 text-white" strokeWidth={3} />
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pt-1 relative">
        {/* Title Row */}
        <div className="mb-1.5 pr-16">
          <h3 className="text-[16px] sm:text-[18px] font-medium text-white tracking-wide">
            {episode.episodeNumber}. {episode.name}
          </h3>
        </div>
          
        {/* Absolute Right Column (Star + Watched) */}
        <div className="absolute top-1 right-0 flex flex-col items-end gap-3 flex-shrink-0">
          {episode.voteAverage > 0 && (
            <div className="flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 fill-[#FBBF24] text-[#FBBF24]" />
              <span className="text-[13px] font-bold text-white">
                {episode.voteAverage.toFixed(1)}
              </span>
            </div>
          )}
          {/* Watched toggle prominently styled */}
          <button
            onClick={handleWatchedClick}
            disabled={watchLoading}
            className={`p-2 rounded-full transition-all ${isWatched ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/30' : 'bg-white/10 text-white/80 hover:text-white hover:bg-white/20 ring-1 ring-white/10 hover:ring-white/30 shadow-lg hover:scale-110'}`}
            aria-label={isWatched ? `${episode.name} is watched` : `Mark ${episode.name} as watched`}
            title={isWatched ? "Watched" : "Mark as watched"}
          >
            <Check className="w-4 h-4" strokeWidth={3} />
          </button>
        </div>

        {/* Date Row */}
        {episode.airDate && (
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-[14px] text-[#9CA3AF]">calendar_today</span>
            <span className="text-[13px] text-[#9CA3AF]">
              {new Date(episode.airDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
            </span>
          </div>
        )}

        {/* Synopsis */}
        {episode.overview && (
          <p className="text-[14px] sm:text-[15px] text-[#9CA3AF] leading-[1.6] line-clamp-3">
            {episode.overview}
          </p>
        )}
      </div>
    </div>
  );
};

export default EpisodeListItem;
