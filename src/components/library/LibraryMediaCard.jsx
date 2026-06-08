import React from 'react';
import { motion } from 'framer-motion';
import { tmdbAdapter } from '../../domain/media';
import MediaCard from '../ui/MediaCard';
import { normalizeWatchStatus } from '../../util/library/watchStatus';
import { useMotionPreferences } from '../../hooks/useMotionPreferences';

const LibraryMediaCard = React.memo(React.forwardRef(({ item, viewMode, onClick, onRemove, imdbRating, imdbVotes }, ref) => {
  const { spring } = useMotionPreferences();
  const media = tmdbAdapter(item);
  if (!media) return null;

  if (viewMode === 'wide' || viewMode === 'bookshelf') {
    return (
      <div
        ref={ref}
        onClick={onClick}
        className="cursor-pointer group flex items-start gap-4 glass-effect rounded-xl p-3 hover:bg-white/10 transition-all relative border border-white/5"
      >
        {item.poster_path ? (
          <div className="flex-shrink-0 w-[72px] h-[108px] rounded-lg overflow-hidden border border-white/10 relative group-hover:scale-105 transition-transform duration-300">
            <img
              src={
                item.poster_path.startsWith('http')
                  ? item.poster_path
                  : `https://image.tmdb.org/t/p/w154${item.poster_path}`
              }
              alt={item.title || item.name}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              style={{ aspectRatio: '2/3' }}
            />
          </div>
        ) : (
          <div className="flex-shrink-0 w-[72px] h-[108px] rounded-lg border border-white/10 bg-white/5 flex items-center justify-center relative overflow-hidden">
            <span className="material-symbols-outlined text-white/20">image</span>
          </div>
        )}

        {/* TV Progress Bar for Wide/Bookshelf Mode */}
        {item.media_type === 'tv' && (() => {
          const isCompleted = normalizeWatchStatus(item?.tracking?.watchStatus ?? item?.watchStatus ?? item?.status) === 'completed';
          const hasProgress = item.tvProgress?.completionPercent !== undefined && item.tvProgress.completionPercent > 0;
          if (!isCompleted && !hasProgress) return null;
          return (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40 overflow-hidden rounded-b-xl opacity-80">
              <div 
                className="h-full bg-[var(--color-accent-primary)] shadow-[0_0_8px_var(--color-accent-primary)]" 
                style={{ width: isCompleted ? '100%' : `${Math.min(100, Math.max(0, item.tvProgress.completionPercent))}%` }} 
              />
            </div>
          );
        })()}

        <div className="flex-1 min-w-0 flex flex-col h-full justify-between py-1">
          <div>
            <h3 className="text-white font-semibold text-[15px] font-secondary group-hover:text-red-500 transition-colors truncate pr-8">
              {item.title || item.name}
            </h3>
            <p className="text-white/50 text-[13px] mt-0.5">
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
              <p className="text-white/60 text-[12px] mt-2 inline-flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded-full w-max">
                <span className="material-symbols-outlined text-[14px]">play_circle</span> Next: S{sn}E{en}
              </p>
            );
          })()}

          <div className="flex items-center gap-2 mt-auto pt-2">
            {imdbRating ? (
              <div className="flex items-center gap-1.5 bg-black/40 px-2 py-1 rounded-md border border-white/5">
                <span className="material-symbols-outlined text-yellow-400 text-[14px]">star</span>
                <span className="text-white font-semibold text-[12px]">{imdbRating.toFixed(1)}</span>
              </div>
            ) : null}
          </div>
        </div>

        <button
          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 text-white/40 hover:text-red-500 hover:bg-black/60 transition-all opacity-0 group-hover:opacity-100"
          onClick={(e) => {
            e.stopPropagation();
            if (onRemove) onRemove();
          }}
          aria-label="Remove from list"
          title="Remove from Library"
        >
          <span className="material-symbols-outlined text-[16px]">delete</span>
        </button>
      </div>
    );
  }

  return (
    <div ref={ref}>
      <MediaCard
        media={media}
        variant="library"
        onClick={onClick}
        onRemove={onRemove}
        imdbRating={imdbRating}
        imdbVotes={imdbVotes}
      />
    </div>
  );
}), (prevProps, nextProps) => {
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.viewMode === nextProps.viewMode
  );
});

export default LibraryMediaCard;
