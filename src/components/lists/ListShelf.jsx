import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { tmdbAdapter } from '../../domain/media';
import { MediaCard, MediaPoster, MediaBadges, MediaMetadata } from '../media/MediaCard';
import { useNavigate } from 'react-router-dom';

const ListShelf = ({ title, items, mapsTo, onRemove, onDelete }) => {
  const scrollRef = useRef(null);
  const navigate = useNavigate();

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold">
          <Link 
            to={mapsTo} 
            className="text-white hover:text-gray-300 transition-colors duration-200"
          >
            {title}
          </Link>
        </h2>
        {onDelete && (
          <button 
            onClick={onDelete}
            className="text-red-500 hover:text-red-400 transition-colors duration-200"
            aria-label="Delete list"
          >
            <Trash2 size={20} />
          </button>
        )}
      </div>
      <div ref={scrollRef} data-horizontal-scroll="true" className="flex overflow-x-auto space-x-4 pb-4 scrollbar-hide">
        {items && items.map((item) => {
          const media = tmdbAdapter(item);
          if (!media) return null;
          return (
            <div key={media.id} className="flex-shrink-0">
              <MediaCard 
                media={media} 
                onClick={() => navigate(media.mediaType === 'tv' ? `/shows/${media.id}` : `/movie/${media.id}`)}
              >
                <MediaPoster media={media} onRemove={onRemove ? () => onRemove(item) : undefined}>
                  <MediaBadges media={media} />
                </MediaPoster>
                <MediaMetadata media={media} />
              </MediaCard>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ListShelf;