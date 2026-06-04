import React from 'react';
import BaseCard from './BaseCard';
import { Play, Clock, Check, Calendar } from 'lucide-react';
import { IMG_CDN_URL } from '../../util/core/constants';

/**
 * EpisodeCard
 * Specialized card optimized for tracking, not discovery.
 * Prioritizes Episode Number, Title, and Watch Status over large artwork.
 * 
 * @param {object} episode - Episode object
 * @param {function} onClick - Card click handler
 * @param {boolean} isWatched - Whether the user has watched this episode
 * @param {function} onToggleWatched - Handler for clicking the watch checkmark
 * @param {boolean} watchLoading - Loading state for the toggle action
 */
const EpisodeCard = ({
  episode,
  onClick,
  isWatched = false,
  onToggleWatched,
  watchLoading = false,
  className = ""
}) => {
  if (!episode) return null;

  const imageUrl = episode.stillPath || episode.still_path
    ? `${IMG_CDN_URL}${episode.stillPath || episode.still_path}`
    : null;

  const handleWatchedClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onToggleWatched && !watchLoading) {
      onToggleWatched(episode);
    }
  };

  // Format date if available
  const airDate = episode.airDate || episode.air_date;
  const formattedDate = airDate ? new Date(airDate).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }) : null;

  // Only render play icon on hover for the overlay
  const renderOverlay = () => (
    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <Play className="w-10 h-10 text-white fill-white" />
    </div>
  );

  return (
    <div className={`w-full ${className}`}>
      <BaseCard
        imageUrl={imageUrl}
        imageAlt={episode.name}
        aspectRatio="16/9"
        orientation="horizontal"
        onClick={() => onClick && onClick(episode)}
        overlay={renderOverlay()}
        fallbackText={`Episode ${episode.episodeNumber || episode.episode_number}`}
        className={isWatched ? 'opacity-70 hover:opacity-100 transition-opacity' : ''}
      >
        <div className="flex flex-col h-full justify-center pr-2">
          {/* Top Metadata Row */}
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-[var(--color-accent-primary)]">
                Episode {episode.episodeNumber || episode.episode_number}
              </span>
              
              {(episode.runtime > 0) && (
                <div className="flex items-center gap-1 text-xs text-[var(--color-text-tertiary)]">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{episode.runtime}m</span>
                </div>
              )}

              {formattedDate && (
                <div className="flex items-center gap-1 text-xs text-[var(--color-text-tertiary)]">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{formattedDate}</span>
                </div>
              )}
            </div>
          </div>

          {/* Title & Watch Action Row */}
          <div className="flex items-start justify-between gap-4 mb-2">
            <h3 className="text-base font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-accent-primary)] transition-colors line-clamp-1 mt-1">
              {episode.name}
            </h3>
            
            {/* Highly visible tracking action */}
            {onToggleWatched && (
              <button
                onClick={handleWatchedClick}
                disabled={watchLoading}
                className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 z-10 
                  ${isWatched 
                    ? 'bg-[var(--color-accent-primary)] text-white shadow-lg' 
                    : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-border-hover)] hover:text-white'
                  }
                  ${watchLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:scale-110'}
                `}
                aria-label={isWatched ? "Mark as unwatched" : "Mark as watched"}
                title={isWatched ? "Watched" : "Mark as watched"}
              >
                <Check className="w-5 h-5" strokeWidth={isWatched ? 3 : 2} />
              </button>
            )}
          </div>

          {/* Overview */}
          {episode.overview && (
            <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 leading-relaxed hidden sm:block">
              {episode.overview}
            </p>
          )}
        </div>
      </BaseCard>
    </div>
  );
};

export default EpisodeCard;
