import React from "react";
import { Star, Clock } from "lucide-react";

const IMG_CDN_URL = "https://image.tmdb.org/t/p";

const EpisodeListItem = ({ episode, onClick }) => {
  return (
    <div
      onClick={onClick}
      className="rounded-lg overflow-hidden cursor-pointer transition-all hover:scale-[1.02] focus-accent"
      style={{ backgroundColor: 'var(--color-bg-elevated)' }}
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
      <div className="flex flex-col sm:flex-row gap-4 p-4">
        {episode.stillPath && (
          <div className="flex-shrink-0 w-full sm:w-48 rounded overflow-hidden">
            <img
              src={`${IMG_CDN_URL}/w300${episode.stillPath}`}
              alt={episode.name}
              className="w-full h-auto object-cover"
              loading="lazy"
              style={{ aspectRatio: '16/9' }}
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
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
              <h3 className="text-lg font-semibold mb-1 truncate" style={{ color: 'var(--color-text-primary)' }}>
                {episode.name}
              </h3>
            </div>
            {episode.voteAverage > 0 && (
              <div className="flex items-center gap-1 ml-4 flex-shrink-0">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-medium" style={{ color: 'var(--color-text-primary)' }}>
                  {episode.voteAverage.toFixed(1)}
                </span>
              </div>
            )}
          </div>

          {episode.overview && (
            <p className="text-sm leading-relaxed line-clamp-2" style={{ color: 'var(--color-text-secondary)' }}>
              {episode.overview}
            </p>
          )}

          {episode.airDate && (
            <div className="mt-2 text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
              Aired: {new Date(episode.airDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EpisodeListItem;
