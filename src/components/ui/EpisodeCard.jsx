import React from 'react';
import BaseCard from './BaseCard';
import { Play, Clock, Check } from 'lucide-react';
import { IMG_CDN_URL } from '../../util/core/constants';

/**
 * EpisodeCard
 * Specialized card optimized for tracking and viewing episodes in a grid.
 * Matches GRID.md specifications.
 */
const EpisodeCard = ({
  episode,
  onClick,
  isWatched = false,
  onToggleWatched,
  watchLoading = false,
  className = "",
  showName = ""
}) => {
  if (!episode) return null;

  const imageUrl = episode.stillPath || episode.still_path
    ? `${IMG_CDN_URL}${episode.stillPath || episode.still_path}`
    : null;

  const seasonNumber = episode.seasonNumber || episode.season_number;
  const episodeNumber = episode.episodeNumber || episode.episode_number;

  const handleWatchedClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onToggleWatched && !watchLoading) {
      onToggleWatched(episode);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick && onClick(episode);
    }
  };

  // Construct descriptive alt text
  const showNamePrefix = showName ? `${showName} — ` : '';
  const imageAlt = `${showNamePrefix}Season ${seasonNumber} Episode ${episodeNumber}`;

  const renderOverlay = () => (
    <>
      {/* Hover Play Button */}
      <div className="absolute inset-0 bg-overlay flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 pointer-events-none">
        <Play className="w-10 h-10 text-inverse fill-current" />
      </div>

      {/* Watch Checkmark (Top Left) */}
      {onToggleWatched && (
        <button
          onClick={handleWatchedClick}
          disabled={watchLoading}
          className={`absolute top-2 left-2 z-30 shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 
            ${isWatched 
              ? 'bg-accent text-inverse shadow-lg shadow-accent/20' 
              : 'bg-backdrop text-white/70 hover:bg-backdrop/80 hover:text-white'
            }
            ${watchLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-110'}
          `}
          aria-label={isWatched ? "Mark as unwatched" : "Mark as watched"}
          title={isWatched ? "Watched" : "Mark as watched"}
        >
          <Check className="w-4 h-4" strokeWidth={isWatched ? 3 : 2} />
        </button>
      )}

      {/* Duration Badge (Top Right) */}
      {(episode.runtime > 0) && (
        <div className="absolute top-2 right-2 z-10 bg-backdrop text-white font-medium px-2 py-1 rounded-[4px] flex items-center gap-1 text-[11px] leading-none">
          <Clock className="w-3 h-3" />
          <span>{episode.runtime}m</span>
        </div>
      )}

      {/* Episode Info Overlay (Bottom Gradient) */}
      <div className="absolute bottom-0 left-0 right-0 w-full bg-gradient-to-t from-black/90 via-black/50 to-transparent p-3 pt-6 flex items-center z-10">
        <span className="text-[14px] font-bold text-white mr-2 shrink-0">
          {episodeNumber}
        </span>
        <span className="text-[14px] font-semibold text-white truncate">
          {episode.name}
        </span>
      </div>
    </>
  );

  return (
    <div 
      className={`w-full group/episodecard ${className}`}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label={`Play Episode ${episodeNumber}: ${episode.name}`}
    >
      <BaseCard
        imageUrl={imageUrl}
        imageAlt={imageAlt}
        aspectRatio="16/9"
        orientation="vertical"
        onClick={() => onClick && onClick(episode)}
        overlay={renderOverlay()}
        fallbackText={`Episode ${episodeNumber}`}
        className={`focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-[12px] [&_.aspect-video]:group-hover/episodecard:brightness-110 ${isWatched ? 'opacity-70 hover:opacity-100 transition-opacity' : ''}`}
      >
        {/* Synopsis */}
        {episode.overview && (
          <p className="text-[12px] md:text-[13px] text-secondary line-clamp-2 leading-[1.4] mt-1">
            {episode.overview}
          </p>
        )}
      </BaseCard>
    </div>
  );
};

export default EpisodeCard;

