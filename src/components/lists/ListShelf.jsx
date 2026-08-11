import React from 'react';
import { Link } from 'react-router-dom';
import { Trash2 } from 'lucide-react';
import { tmdbAdapter } from '../../domain/media';
import MediaCard from '../ui/MediaCard';
import Carousel from '../ui/Carousel';
import SectionHeader from '../ui/SectionHeader';
import { useNavigate } from 'react-router-dom';

const ListShelf = ({ title, items, mapsTo, onRemove, onDelete }) => {
  const navigate = useNavigate();

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-semibold text-[var(--color-text-primary)]">
          <Link 
            to={mapsTo} 
            className="hover:text-[var(--color-text-secondary)] transition-colors duration-200"
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
      <Carousel>
        {items && items.map((item) => {
          const media = tmdbAdapter(item);
          if (!media) return null;
          return (
            <MediaCard 
              key={media.id} 
              media={media} 
              variant="carousel"
              onRemove={onRemove ? () => onRemove(item) : undefined}
              onClick={() => navigate(media.mediaType === 'tv' ? `/shows/${media.id}` : `/movie/${media.id}`)}
            />
          );
        })}
      </Carousel>
    </div>
  );
};

export default ListShelf;