import React, { useState } from 'react';
import { Play } from 'lucide-react';

/**
 * BaseCard
 * Foundation for all grid/carousel cards (Media, Person, Episode)
 * 
 * @param {string} imageUrl - The main image to display
 * @param {string} imageAlt - Alt text for the image
 * @param {string} aspectRatio - "2/3" (Poster/Person) or "16/9" (Backdrop)
 * @param {React.ReactNode} children - Content below the image (title, metadata)
 * @param {React.ReactNode} overlay - Content rendered over the image (badges, buttons)
 * @param {boolean} isHoverable - Whether the card scales and glows on hover
 * @param {function} onClick - Click handler for the card
 * @param {string} fallbackText - Text to display if image fails/is missing
 * @param {string} orientation - "vertical" (default) or "horizontal" (e.g. for Episode lists)
 */
const BaseCard = ({
  imageUrl,
  imageAlt = "Card image",
  aspectRatio = "2/3",
  children,
  overlay,
  isHoverable = true,
  onClick,
  fallbackText,
  orientation = "vertical",
  className = ""
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  // Compute standard aspect ratio class
  const aspectRatioClass = aspectRatio === "16/9" ? "aspect-video" : "aspect-[2/3]";

  // Layout classes based on orientation
  const isHorizontal = orientation === "horizontal";
  const containerClasses = isHorizontal 
    ? `group flex flex-col sm:flex-row w-full gap-4 ${isHoverable ? 'cursor-pointer' : ''} ${className}`
    : `group flex flex-col w-full ${isHoverable ? 'cursor-pointer' : ''} ${className}`;

  const imageWrapperClasses = isHorizontal
    ? `relative w-full sm:w-1/3 xl:w-1/4 shrink-0 ${aspectRatioClass} rounded-[12px] overflow-hidden bg-[var(--color-bg-card)] border border-[var(--color-border)] transition-all duration-200 ${
        isHoverable ? 'group-hover:border-[var(--color-border-hover)] group-hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)] group-hover:scale-[1.03] sm:group-hover:scale-[1.02] group-active:scale-[0.98]' : ''
      }`
    : `relative w-full ${aspectRatioClass} rounded-[12px] overflow-hidden bg-[var(--color-bg-card)] border border-[var(--color-border)] transition-all duration-200 ${
        isHoverable ? 'group-hover:border-[var(--color-border-hover)] group-hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)] group-hover:scale-[1.03] group-active:scale-[0.98]' : ''
      }`;

  const contentClasses = isHorizontal
    ? "flex-1 flex flex-col py-2"
    : "mt-3 flex flex-col gap-1 px-1";

  return (
    <div 
      className={containerClasses}
      onClick={onClick}
    >
      {/* Image Container with strict 12px rounding and unified hover scale */}
      <div className={imageWrapperClasses}>
        {/* Loading Skeleton */}
        {!imageLoaded && !imageError && imageUrl && (
          <div className="absolute inset-0 bg-gray-800 animate-pulse" />
        )}

        {/* Image */}
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt={imageAlt}
            className={`w-full h-full object-cover transition-opacity duration-200 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          /* Fallback State */
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 bg-[var(--color-bg-surface)]">
            <span className="material-symbols-outlined text-4xl text-gray-600 mb-2">image_not_supported</span>
            {fallbackText && (
              <span className="text-xs text-center text-gray-500 font-medium">{fallbackText}</span>
            )}
          </div>
        )}

        {/* Hover Overlay Gradient (Darkens image slightly to make overlay items pop) */}
        {isHoverable && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 pointer-events-none" />
        )}

        {/* Custom Overlays (Badges, Track buttons, Play buttons) */}
        {overlay}
      </div>

      {/* Content Area (Title, Metadata) */}
      {children && (
        <div className={contentClasses}>
          {children}
        </div>
      )}
    </div>
  );
};

export default BaseCard;
