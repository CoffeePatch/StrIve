import React from 'react';
import BaseCard from './BaseCard';
import Badge from './Badge';
import { Star, Tv, Film, Trash2, Play, MoreVertical } from 'lucide-react';
import { POSTER_CDN_URL, BACKDROP_CDN_URL } from '../../util/core/constants';

const formatCount = (num) => {
  if (num === null || num === undefined) return null;
  const value = typeof num === 'number' ? num : Number(num);
  if (!Number.isFinite(value)) return null;
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return `${value}`;
};

/**
 * MediaCard
 * Universal foundation for displaying Movies and TV Shows.
 * 
 * @param {object} media - The media object (movie or tv show)
 * @param {string} variant - 'carousel', 'grid', 'library', 'recommendation'
 * @param {function} onClick - Click handler for the card
 * @param {function} onRemove - Optional remove handler (for library/lists)
 */
const MediaCard = ({
  media,
  variant = 'carousel',
  onClick,
  onRemove,
  onQuickActions,
  className = "",
  imdbRating,
  imdbVotes,
  disableHover = false
}) => {
  if (!media) return null;

  // 1. Data Normalization
  const title = media.title || media.name || media.original_title || media.original_name;
  const rawDate = media.releaseDate || media.firstAirDate || media.release_date || media.first_air_date;
  const year = media.releaseYear && media.releaseYear !== "N/A" ? media.releaseYear : (rawDate ? new Date(rawDate).getFullYear() : null);
  const rating = media.rating?.score || media.voteAverage || media.vote_average;
  const type = media.mediaType || media.media_type || (media.firstAirDate || media.first_air_date || media.name ? 'tv' : 'movie');
  
  // URL for the card to enable middle-click, right-click, etc. (disabled when disableHover/selection mode is true)
  const toUrl = (media.id && !disableHover) ? `/${type === 'tv' ? 'shows' : 'movie'}/${media.id}` : undefined;

  // 2. Image Resolution
  const rawPosterPath = media.posterPath || media.poster_path;
  const rawBackdropPath = media.backdropPath || media.backdrop_path;

  const posterUrl = rawPosterPath
    ? (rawPosterPath.startsWith('http') ? rawPosterPath : `${POSTER_CDN_URL}${rawPosterPath}`)
    : null;
    
  const backdropUrl = rawBackdropPath
    ? (rawBackdropPath.startsWith('http') ? rawBackdropPath : `${BACKDROP_CDN_URL}${rawBackdropPath}`)
    : null;

  // Determine standard image and aspect ratio based on variant
  // Usually, posters are 2:3. For some specific recommendation variants, we might want 16:9 backdrops.
  // For standard Browse/Grid/Carousel/Library -> 2:3
  const isBackdrop = variant === 'recommendation_backdrop' || variant === 'continue_watching';
  const imageUrl = isBackdrop ? backdropUrl : posterUrl;
  const aspectRatio = isBackdrop ? "16/9" : "2/3";

  // 3. Variant Sizing
  // Standardizing widths so cards don't jitter across different screens
  let widthClass = "";
  if (variant === 'carousel') widthClass = "w-36 sm:w-44 lg:w-48"; // Responsive width for carousels
  else if (variant === 'continue_watching') widthClass = "w-64 sm:w-72 lg:w-80"; // Wider for 16:9
  else if (variant === 'recommendation') widthClass = "w-32 sm:w-36 md:w-40 lg:w-44"; // Smaller responsive width for recommendations
  else if (variant === 'grid' || variant === 'library') widthClass = "w-full"; // Grid handles its own column sizing
  else widthClass = "w-full"; // Default fluid

  const handleCardClick = (e) => {
    if (onClick) {
      e.preventDefault(); // If onClick is provided, prevent standard navigation to handle it custom
      onClick(media);
    }
  };

  const handleRemoveClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onRemove) onRemove(media);
  };

  // 4. Overlays (Badges, Delete buttons, Play icons)
  const renderOverlay = () => {
    return (
      <>
        {/* IMDb Rating Pill for Library */}
        {variant === 'library' && imdbRating && (
          <div className="absolute top-2 left-2 z-10 flex flex-row items-center gap-1.5 px-2 py-1 rounded-md border border-border-subtle bg-backdrop backdrop-blur-md shadow-sm pointer-events-none">
            <span className="bg-[#F5C518] text-[#000000] text-[9px] font-black px-1 rounded-sm tracking-tighter leading-none" style={{ paddingTop: '2px', paddingBottom: '2px' }}>
              IMDb
            </span>
            <span className="text-white text-xs font-bold leading-none mt-[1px]">{Number(imdbRating).toFixed(1)}</span>
            {imdbVotes ? (
              <span className="text-white/70 text-[10px] leading-none mt-[1px]">({formatCount(imdbVotes)})</span>
            ) : null}
          </div>
        )}

        {/* Play Icon & Next Episode on Hover */}
        {!disableHover && (
          <div className="absolute inset-0 bg-overlay flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
            <div className="w-12 h-12 rounded-full bg-accent/90 flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform duration-200 shadow-lg">
              <Play className="w-6 h-6 text-inverse ml-1" fill="currentColor" />
            </div>
            {media.tracking?.nextEpisodeLabel && (media.tracking?.status === 'watching' || media.tracking?.status === 'plan_to_watch') && (
              <div className="mt-3 text-inverse text-xs font-bold tracking-wide drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] px-2 py-1 rounded bg-overlay backdrop-blur-sm border border-border-subtle">
                Next: {media.tracking.nextEpisodeLabel}
              </div>
            )}
          </div>
        )}

        {/* Remove or Quick Actions Button */}
        {onQuickActions ? (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onQuickActions(media, e);
            }}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-backdrop text-white/70 hover:text-white hover:bg-backdrop/80 opacity-0 group-hover:opacity-100 transition-all duration-200 z-20 focus:outline-none focus:opacity-100"
            aria-label="Quick Actions"
            title="Quick Actions"
          >
            <MoreVertical className="w-4 h-4" />
          </button>
        ) : onRemove ? (
          <button
            onClick={handleRemoveClick}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-backdrop text-white/70 hover:text-red-500 hover:bg-backdrop/80 opacity-0 group-hover:opacity-100 transition-all duration-200 z-20 focus:outline-none focus:opacity-100"
            aria-label="Remove"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        ) : null}

        {/* TV Progress Bar */}
        {(media.tracking?.status === 'completed' || (media.tvProgress && media.tvProgress.completionPercent !== undefined && media.tvProgress.completionPercent > 0)) && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-backdrop z-20 overflow-hidden">
            <div 
              className="h-full bg-accent shadow-sm shadow-accent/50" 
              style={{ width: media.tracking?.status === 'completed' ? '100%' : `${Math.min(100, Math.max(0, media.tvProgress.completionPercent))}%` }} 
            />
          </div>
        )}
      </>
    );
  };

  return (
    <div 
      className={`media-card-wrapper flex-none ${widthClass} ${className}`}
    >
      <BaseCard
        imageUrl={imageUrl}
        imageAlt={title}
        aspectRatio={aspectRatio}
        onClick={handleCardClick}
        to={toUrl}
        isHoverable={!disableHover}
        fallbackText={title}
        overlay={renderOverlay()}
      >
        {/* Only show metadata text if not a standard carousel (posters look better without text) */}
        {variant !== 'carousel' && (
          <div className="flex flex-col mt-2">
            <h3 className="text-sm sm:text-base font-bold text-primary truncate group-hover:text-accent transition-colors block w-full">
              {title}
            </h3>
            
            <div className="flex items-center justify-between text-xs text-secondary mt-1 w-full">
              <div className="flex items-center gap-1.5">
                {variant === 'continue_watching' && media.tracking?.nextEpisodeLabel ? (
                  <span className="leading-none text-muted">{media.tracking.nextEpisodeLabel}</span>
                ) : (
                  <>
                    <span className="leading-none mt-[1px]">{year && !isNaN(year) ? year : ''}</span>
                    <div className="text-muted flex items-center">
                      {type === 'tv' ? <Tv className="w-3.5 h-3.5" /> : <Film className="w-3.5 h-3.5" />}
                    </div>
                  </>
                )}
              </div>

              {variant !== 'continue_watching' && (
                <div className="flex items-center">
                  {rating > 0 && (
                    <div className="flex items-center gap-1 text-yellow-500 font-medium">
                      <Star className="w-3.5 h-3.5 mb-[1px]" fill="currentColor" />
                      <span className="leading-none mt-[1px]">{Number(rating).toFixed(1)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </BaseCard>
    </div>
  );
};

export default React.memo(MediaCard, (prevProps, nextProps) => {
  return (
    prevProps.variant === nextProps.variant &&
    prevProps.className === nextProps.className &&
    prevProps.imdbRating === nextProps.imdbRating &&
    prevProps.imdbVotes === nextProps.imdbVotes &&
    prevProps.onClick === nextProps.onClick &&
    prevProps.onRemove === nextProps.onRemove &&
    prevProps.onQuickActions === nextProps.onQuickActions &&
    prevProps.media?.id === nextProps.media?.id &&
    prevProps.media?.title === nextProps.media?.title &&
    prevProps.media?.name === nextProps.media?.name &&
    prevProps.media?.tracking?.watchStatus === nextProps.media?.tracking?.watchStatus &&
    prevProps.media?.tvProgress?.completionPercent === nextProps.media?.tvProgress?.completionPercent
  );
});
