import React from 'react';
import { Link } from 'react-router-dom';
import { tmdbAdapter } from '../../domain/media';
import MediaCard from '../ui/MediaCard';
import { normalizeWatchStatus } from '../../util/library/watchStatus';

const LibraryMediaCard = React.memo(React.forwardRef(({ 
  item, 
  allItems,
  viewMode, 
  onClick, 
  onRemove, 
  onQuickActions, 
  imdbRating, 
  imdbVotes,
  isSelectionMode,
  isSelected,
  onToggleSelect,
  onSelectRange,
  onEnterSelectionMode,
  ...rest 
}, ref) => {
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);

  const media = React.useMemo(() => tmdbAdapter(item), [item]);
  if (!media) return null;

  const toUrl = item?.id ? `/${item.media_type === 'tv' ? 'shows' : 'movie'}/${item.id}` : undefined;
  const Component = (toUrl && !isSelectionMode) ? Link : 'div';
  
  const handleInteraction = (e) => {
    const isShift = e?.shiftKey;
    const isCtrlOrCmd = e?.ctrlKey || e?.metaKey;

    if (!isSelectionMode && isCtrlOrCmd) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      onEnterSelectionMode?.();
      onToggleSelect?.(item);
    } else if (isSelectionMode) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      if (isShift && onSelectRange && allItems) {
        onSelectRange(allItems, item);
      } else {
        onToggleSelect?.(item);
      }
    } else if (onClick) {
      onClick(item);
    }
  };

  const componentProps = {
    ...(toUrl && !isSelectionMode ? { to: toUrl } : {}),
    className: `cursor-pointer group flex items-start gap-4 glass-effect rounded-xl p-3 transition-all relative border ${
      isSelected ? 'border-accent bg-accent/10' : 'border-border-subtle hover:bg-surface-hover'
    }`,
    onClick: handleInteraction
  };

  const hasPoster = item.poster_path && item.poster_path !== "";

  if (viewMode === 'wide' || viewMode === 'bookshelf') {
    return (
      <Component
        ref={ref}
        {...componentProps}
        {...rest}
      >
        {hasPoster && !imageError ? (
          <div className="flex-shrink-0 w-[72px] h-[108px] rounded-lg overflow-hidden border border-border-subtle relative group-hover:scale-105 transition-transform duration-300 bg-surface">
            <img
              src={
                item.poster_path.startsWith('http')
                  ? item.poster_path
                  : `https://image.tmdb.org/t/p/w154${item.poster_path}`
              }
              alt={item.title || item.name}
              className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              loading="lazy"
              decoding="async"
              style={{ aspectRatio: '2/3' }}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
            {!imageLoaded && (
              <div className="absolute inset-0 bg-surface/80 animate-pulse flex items-center justify-center">
                <span className="material-symbols-outlined text-muted text-xl animate-bounce">image</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-shrink-0 w-[72px] h-[108px] rounded-lg border border-border-subtle bg-surface flex flex-col items-center justify-center p-1 text-center relative overflow-hidden">
            <span className="material-symbols-outlined text-muted text-xl mb-1">
              {item.media_type === 'tv' ? 'live_tv' : 'movie'}
            </span>
            <span className="text-[9px] text-secondary font-secondary line-clamp-2 px-0.5 leading-tight font-medium">
              {item.title || item.name}
            </span>
          </div>
        )}

        {/* TV Progress Bar for Wide/Bookshelf Mode */}
        {item.media_type === 'tv' && (() => {
          const isCompleted = normalizeWatchStatus(item?.tracking?.watchStatus ?? item?.watchStatus ?? item?.status) === 'completed';
          const hasProgress = item.tvProgress?.completionPercent !== undefined && item.tvProgress.completionPercent > 0;
          if (!isCompleted && !hasProgress) return null;
          return (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-overlay overflow-hidden rounded-b-xl opacity-80">
              <div 
                className="h-full bg-accent shadow-sm shadow-accent/50" 
                style={{ width: isCompleted ? '100%' : `${Math.min(100, Math.max(0, item.tvProgress.completionPercent))}%` }} 
              />
            </div>
          );
        })()}

        <div className="flex-1 min-w-0 flex flex-col h-full justify-between py-1">
          <div>
            <h3 className="text-primary font-semibold text-[15px] font-secondary group-hover:text-accent transition-colors truncate pr-8">
              {item.title || item.name}
            </h3>
            <p className="text-muted text-[13px] mt-0.5">
              {(item.release_date || item.first_air_date)?.split('-')[0]} •{' '}
              {item.media_type === 'tv' ? 'Series' : 'Movie'}
            </p>
          </div>

          {item.media_type === 'tv' && (() => {
            const nextToWatch = item?.tvProgress?.nextToWatch || null;
            const sn = Number(nextToWatch?.seasonNumber);
            const en = Number(nextToWatch?.episodeNumber);
            const hasNext = Number.isInteger(sn) && Number.isInteger(en) && sn > 0 && en > 0;

            if (!hasNext) return null;
            return (
              <p className="text-secondary text-[12px] mt-2 inline-flex items-center gap-1 bg-surface px-2 py-0.5 rounded-full w-max">
                <span className="material-symbols-outlined text-[14px]">play_circle</span> Next: S{sn}E{en}
              </p>
            );
          })()}

          <div className="flex items-center gap-2 mt-auto pt-2">
            {imdbRating ? (
              <div className="flex items-center gap-1.5 bg-backdrop px-2 py-1 rounded-md border border-border-subtle">
                <span className="material-symbols-outlined text-yellow-400 text-[14px]">star</span>
                <span className="text-primary font-semibold text-[12px]">{imdbRating.toFixed(1)}</span>
              </div>
            ) : null}
          </div>
        </div>

        {isSelectionMode && (
          <div className={`absolute top-3 left-3 z-10 w-6 h-6 rounded-md flex items-center justify-center transition-all ${isSelected ? 'bg-accent text-white border-accent' : 'bg-black/50 border border-white/50 text-transparent hover:bg-black/70'}`}>
            <span className="material-symbols-outlined text-[16px]">check</span>
          </div>
        )}

        {!isSelectionMode && onQuickActions ? (
          <button
            className="absolute top-2 right-2 p-1.5 rounded-full bg-backdrop text-secondary hover:text-primary hover:bg-surface-hover transition-all opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onQuickActions(item, e);
            }}
            aria-label="Quick actions"
            title="Quick Actions"
          >
            <span className="material-symbols-outlined text-[16px]">more_vert</span>
          </button>
        ) : !isSelectionMode && onRemove ? (
          <button
            className="absolute top-2 right-2 p-1.5 rounded-full bg-backdrop text-secondary hover:text-error hover:bg-surface-hover transition-all opacity-0 group-hover:opacity-100"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (onRemove) onRemove(item);
            }}
            aria-label="Remove from list"
            title="Remove from Library"
          >
            <span className="material-symbols-outlined text-[16px]">delete</span>
          </button>
        ) : null}
      </Component>
    );
  }

  return (
    <div ref={ref} {...rest} className="relative cursor-pointer" onClick={handleInteraction}>
      <MediaCard
        media={media}
        variant="library"
        onClick={isSelectionMode ? undefined : () => onClick(item)}
        onRemove={isSelectionMode || !onRemove ? undefined : () => onRemove(item)}
        onQuickActions={isSelectionMode || !onQuickActions ? undefined : (media, e) => onQuickActions(item, e)}
        imdbRating={imdbRating}
        imdbVotes={imdbVotes}
        disableHover={isSelectionMode}
      />
      {isSelectionMode && (
        <div 
          className={`absolute inset-0 z-20 rounded-xl transition-all border-[3px] pointer-events-none ${isSelected ? 'border-accent bg-accent/10' : 'border-transparent hover:border-white/30 hover:bg-white/5'}`} 
        />
      )}
      {isSelectionMode && (
        <div className={`absolute top-2 left-2 z-30 w-6 h-6 rounded-md flex items-center justify-center transition-all ${isSelected ? 'bg-accent text-white border-accent' : 'bg-black/50 border border-white/50 text-transparent'}`}>
          <span className="material-symbols-outlined text-[16px]">check</span>
        </div>
      )}
    </div>
  );
}), (prevProps, nextProps) => {
  return (
    prevProps.item === nextProps.item &&
    prevProps.allItems === nextProps.allItems &&
    prevProps.viewMode === nextProps.viewMode &&
    prevProps.imdbRating === nextProps.imdbRating &&
    prevProps.imdbVotes === nextProps.imdbVotes &&
    prevProps.onClick === nextProps.onClick &&
    prevProps.onRemove === nextProps.onRemove &&
    prevProps.onQuickActions === nextProps.onQuickActions &&
    prevProps.isSelectionMode === nextProps.isSelectionMode &&
    prevProps.isSelected === nextProps.isSelected
  );
});

export default LibraryMediaCard;
