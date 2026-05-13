import React from "react";
import { Play, Clock, Check } from "lucide-react";

const IMG_CDN_URL = "https://image.tmdb.org/t/p";

const EpisodeCard = ({ episode, onClick, isWatched = false, onToggleWatched, watchLoading = false }) => {
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
      className="group rounded-lg overflow-hidden cursor-pointer transition-all duration-150 hover:scale-[1.03] active:scale-[0.98] focus-accent"
      style={{ backgroundColor: 'var(--Color-bg-elevated)' }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`Episode ${episode.episodeNumber}: ${episode.name}`}
    >
      <div className="relative w-full aspect-video overflow-hidden bg-gray-800">
        {episode.stillPath ? (
          <>
            <img
              src={`${IMG_CDN_URL}/w300${episode.stillPath}`}
              alt={episode.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
              <Play className="w-12 h-12 text-white fill-white" />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Play className="w-12 h-12 text-gray-600" />
          </div>
        )}

        {/* Watched state overlay for watched episodes */}
        {isWatched && (
          <div className="absolute inset-0 bg-black/40 pointer-events-none" />
        )}

        {/* Watched toggle badge */}
        <button
          onClick={handleWatchedClick}
          disabled={watchLoading}
          className={`episode-watched-badge ${isWatched ? 'episode-watched-badge--active' : 'episode-watched-badge--idle'}`}
          aria-label={isWatched ? `${episode.name} is watched` : `Mark ${episode.name} as watched`}
          title={isWatched ? "Watched" : "Mark as watched"}
        >
          <Check className="w-4 h-4" strokeWidth={3} />
        </button>
      </div>

      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--color-accent-primary)' }}>
            Episode {episode.episodeNumber}
          </span>
          {episode.runtime && (
            <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              <Clock className="w-3 h-3" />
              <span>{episode.runtime} min</span>
            </div>
          )}
        </div>

        <h3 className="text-base font-semibold mb-1 line-clamp-2 min-h-[3rem]" style={{ color: 'var(--color-text-primary)' }}>
          {episode.name}
        </h3>

        {episode.overview && (
          <p className="text-sm leading-relaxed line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>
            {episode.overview}
          </p>
        )}
      </div>
    </div>
  );
};

export default EpisodeCard;
