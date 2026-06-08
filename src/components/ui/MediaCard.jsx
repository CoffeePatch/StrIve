import React from 'react';
import BaseCard from './BaseCard';
import Badge from './Badge';
import { Star, Tv, Film, Trash2, Play } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMotionPreferences } from '../../hooks/useMotionPreferences';
import { IMG_CDN_URL } from '../../util/core/constants';

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
  className = "",
  imdbRating,
  imdbVotes
}) => {
  if (!media) return null;

  // 1. Data Normalization
  const title = media.title || media.name || media.original_title || media.original_name;
  const rawDate = media.releaseDate || media.firstAirDate || media.release_date || media.first_air_date;
  const year = media.releaseYear && media.releaseYear !== "N/A" ? media.releaseYear : (rawDate ? new Date(rawDate).getFullYear() : null);
  const rating = media.rating?.score || media.voteAverage || media.vote_average;
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
  else if (variant === 'recommendation') widthClass = "w-32 sm:w-36 md:w-40 lg:w-44"; // Smaller responsive width for recommendations
  else if (variant === 'grid' || variant === 'library') widthClass = "w-full"; // Grid handles its own column sizing
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
        {/* IMDb Rating Pill for Library */}
        {variant === 'library' && imdbRating && (
          <div className="absolute top-2 left-2 z-10 flex flex-row items-center gap-1.5 px-2 py-1 rounded-md border border-white/10 bg-black/60 backdrop-blur-md shadow-sm pointer-events-none">
            <span className="bg-[#F5C518] text-black text-[9px] font-black px-1 rounded-sm tracking-tighter leading-none" style={{ paddingTop: '2px', paddingBottom: '2px' }}>
              IMDb
            </span>
            <span className="text-white text-xs font-bold leading-none mt-[1px]">{Number(imdbRating).toFixed(1)}</span>
            {imdbVotes ? (
              <span className="text-[#9CA3AF] text-[10px] leading-none mt-[1px]">({formatCount(imdbVotes)})</span>
            ) : null}
          </div>
        )}

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

  const { spring, shouldReduceMotion } = useMotionPreferences();

  return (
    <motion.div 
      className={`flex-none ${widthClass} ${className}`}
      whileHover={shouldReduceMotion ? undefined : { scale: 1.03, y: -2 }}
      whileTap={shouldReduceMotion ? undefined : { scale: 0.95 }}
      transition={spring}
    >
      <BaseCard
        imageUrl={imageUrl}
        imageAlt={title}
        aspectRatio={aspectRatio}
        onClick={handleCardClick}
        fallbackText={title}
        overlay={renderOverlay()}
      >
        {/* Standardized Metadata Hierarchy: Title -> Year & Type -> Rating */}
        <h3 className="text-sm sm:text-base font-bold text-white truncate group-hover:text-[var(--color-accent-primary)] transition-colors mt-2 block w-full">
          {title}
        </h3>
        
        <div className="flex items-center justify-between text-xs text-gray-400 mt-1.5 w-full">
          <div className="flex items-center gap-1.5">
            <span className="leading-none mt-[1px]">{year && !isNaN(year) ? year : ''}</span>
            <div className="text-gray-500 flex items-center">
              {type === 'tv' ? <Tv className="w-3.5 h-3.5" /> : <Film className="w-3.5 h-3.5" />}
            </div>
          </div>

          <div className="flex items-center">
            {rating > 0 && (
              <div className="flex items-center gap-1 text-yellow-500 font-medium">
                <Star className="w-3.5 h-3.5 mb-[1px]" fill="currentColor" />
                <span className="leading-none mt-[1px]">{Number(rating).toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
      </BaseCard>
    </motion.div>
  );
};

export default MediaCard;
