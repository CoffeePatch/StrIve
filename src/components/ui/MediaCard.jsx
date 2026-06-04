import React from 'react';
import BaseCard from './BaseCard';
import Badge from './Badge';
import { Star, Tv, Film, Trash2, Play } from 'lucide-react';
import { IMG_CDN_URL } from '../../util/core/constants';

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
  className = ""
}) => {
  if (!media) return null;

  // 1. Data Normalization
  const title = media.title || media.name || media.original_title || media.original_name;
  const rawDate = media.releaseDate || media.firstAirDate || media.release_date || media.first_air_date;
  const year = rawDate ? new Date(rawDate).getFullYear() : null;
  const rating = media.voteAverage || media.vote_average;
  const type = media.mediaType || media.media_type || (media.firstAirDate || media.first_air_date || media.name ? 'tv' : 'movie');

  // 2. Image Resolution
  const rawPosterPath = media.posterPath || media.poster_path;
  const rawBackdropPath = media.backdropPath || media.backdrop_path;

  const posterUrl = rawPosterPath
    ? (rawPosterPath.startsWith('http') ? rawPosterPath : `${IMG_CDN_URL}${rawPosterPath}`)
    : null;
    
  const backdropUrl = rawBackdropPath
    ? (rawBackdropPath.startsWith('http') ? rawBackdropPath : `${IMG_CDN_URL}${rawBackdropPath}`)
    : null;

  // Determine standard image and aspect ratio based on variant
  // Usually, posters are 2:3. For some specific recommendation variants, we might want 16:9 backdrops.
  // For standard Browse/Grid/Carousel/Library -> 2:3
  const isBackdrop = variant === 'recommendation_backdrop';
  const imageUrl = isBackdrop ? backdropUrl : posterUrl;
  const aspectRatio = isBackdrop ? "16/9" : "2/3";

  // 3. Variant Sizing
  // Standardizing widths so cards don't jitter across different screens
  let widthClass = "";
  if (variant === 'carousel') widthClass = "w-40 sm:w-48 lg:w-52"; // Responsive width for carousels
  else if (variant === 'grid') widthClass = "w-full"; // Grid handles its own column sizing
  else if (variant === 'library') widthClass = "w-36 sm:w-44 md:w-48";
  else widthClass = "w-full"; // Default fluid

  const handleCardClick = () => {
    if (onClick) onClick(media);
  };

  const handleRemoveClick = (e) => {
    e.stopPropagation();
    if (onRemove) onRemove(media);
  };

  // 4. Overlays (Badges, Delete buttons, Play icons)
  const renderOverlay = () => {
    return (
      <>
        {/* Play Icon on Hover */}
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <div className="w-12 h-12 rounded-full bg-[var(--color-accent-primary)]/90 flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform duration-200 shadow-lg">
            <Play className="w-6 h-6 text-white ml-1" fill="currentColor" />
          </div>
        </div>

        {/* Remove Button for Library Variant */}
        {onRemove && (
          <button
            onClick={handleRemoveClick}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-gray-300 hover:text-red-500 hover:bg-black/80 opacity-0 group-hover:opacity-100 transition-all duration-200 z-20 focus:outline-none focus:opacity-100"
            aria-label="Remove"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </>
    );
  };

  return (
    <div className={`flex-none ${widthClass} ${className}`}>
      <BaseCard
        imageUrl={imageUrl}
        imageAlt={title}
        aspectRatio={aspectRatio}
        onClick={handleCardClick}
        fallbackText={title}
        overlay={renderOverlay()}
      >
        {/* Standardized Metadata Hierarchy: Title -> Year & Rating -> Type */}
        <h3 className="text-sm sm:text-base font-bold text-white truncate group-hover:text-[var(--color-accent-primary)] transition-colors mt-2">
          {title}
        </h3>
        
        <div className="flex items-center justify-between text-xs text-gray-400 mt-1">
          <div className="flex items-center gap-2">
            {year && !isNaN(year) && <span>{year}</span>}
            {year && !isNaN(year) && rating > 0 && <span className="w-1 h-1 rounded-full bg-gray-600" />}
            {rating > 0 && (
              <div className="flex items-center gap-1 text-yellow-500 font-medium">
                <Star className="w-3 h-3" fill="currentColor" />
                <span>{Number(rating).toFixed(1)}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center text-gray-500">
            {type === 'tv' ? <Tv className="w-3 h-3" /> : <Film className="w-3 h-3" />}
          </div>
        </div>
      </BaseCard>
    </div>
  );
};

export default MediaCard;
