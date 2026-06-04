import React from 'react';
import { tmdbAdapter } from '../../domain/media';
import MediaCard from '../ui/MediaCard';
import { normalizeWatchStatus } from '../../util/library/watchStatus';

const LibraryGrid = ({ items, viewMode, handleItemClick, handleRemove, getImdbRating, getImdbVotes }) => {
  return (
    <div
      className={
        viewMode === 'bookshelf'
          ? 'space-y-8'
          : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6'
      }
    >
      {viewMode === 'bookshelf' ? (
        <div className="space-y-6">
          {items.map((item) => (
            <div
              key={`${item.media_type}-${item.id}`}
              onClick={() => handleItemClick(item)}
              className="cursor-pointer group"
            >
              <div className="flex items-start gap-6 glass-effect rounded-xl p-4 hover:bg-white/10 transition-all relative">
                {item.poster_path && (
                  <div className="flex-shrink-0 w-24 h-36 rounded-lg overflow-hidden border border-white/10 relative group">
                    <img
                      src={
                        item.poster_path.startsWith('http')
                          ? item.poster_path
                          : `https://image.tmdb.org/t/p/w342${item.poster_path}`
                      }
                      alt={item.title || item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    {/* Trash button on bookshelf view */}
                    <button
                      className="absolute top-1 left-1 p-1 opacity-100 text-yellow-400 hover:text-red-500 transition-colors z-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(item);
                      }}
                      aria-label="Remove from list"
                    >
                      <span className="material-symbols-outlined text-xs">delete</span>
                    </button>
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-lg font-secondary group-hover:text-red-600 transition-colors">
                    {item.title || item.name}
                  </h3>
                  <p className="text-white/60 text-sm mt-1">
                    {(item.release_date || item.first_air_date)?.split('-')[0]} •{' '}
                    {item.media_type === 'tv' ? 'Series' : 'Film'}
                  </p>
                  {item.media_type === 'tv' && (() => {
                    const nextToWatch = item?.tvProgress?.nextToWatch || null;
                    const sn = Number(nextToWatch?.seasonNumber);
                    const en = Number(nextToWatch?.episodeNumber);
                    const hasNext = Number.isInteger(sn) && Number.isInteger(en);
                    const status = normalizeWatchStatus(
                      item?.tracking?.watchStatus ?? item?.watchStatus ?? item?.status
                    );
                    const fallback = !hasNext && (status === 'plan_to_watch' || status === 'watching' || !status);
                    const label = hasNext ? `S${sn}E${en}` : (fallback ? 'S1E1' : null);
                    if (!label) return null;
                    return (
                      <p className="text-white/60 text-xs mt-2">
                        Next: {label}
                      </p>
                    );
                  })()}
                  {getImdbRating(item) && (
                    <div className="flex items-center gap-2 mt-3">
                      <span className="material-symbols-outlined text-yellow-400 text-sm">
                        star
                      </span>
                      <span className="text-yellow-400 font-semibold">
                        {getImdbRating(item).toFixed(1)}
                      </span>
                      {getImdbVotes(item) && (
                        <span className="text-white/40 text-sm">
                          {(getImdbVotes(item) / 1000000).toFixed(1)}M votes
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        items.map((item) => {
          const media = tmdbAdapter(item);
          if (!media) return null;
          return (
            <MediaCard 
              key={`${media.mediaType}-${media.id}`}
              media={media} 
              variant="library"
              onClick={() => handleItemClick(item)}
              onRemove={() => handleRemove(item)}
            />
          );
        })
      )}
    </div>
  );
};

export default LibraryGrid;
