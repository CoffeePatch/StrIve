import React from 'react';
import { useMotionPreferences } from '../../hooks/useMotionPreferences';
import LibraryMediaCard from './LibraryMediaCard';

const LibraryGrid = ({ items, viewMode, handleItemClick, handleRemove, getImdbRating, getImdbVotes }) => {
  const { spring } = useMotionPreferences();

  return (
    <div
      className={
        viewMode === 'wide' || viewMode === 'bookshelf'
          ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
          : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6'
      }
    >
      {items.map((item) => (
        <LibraryMediaCard
          key={`${item.media_type || item.mediaType}-${item.id}`}
          item={item}
          viewMode={viewMode}
          onClick={() => handleItemClick(item)}
          onRemove={handleRemove ? () => handleRemove(item) : undefined}
          imdbRating={getImdbRating ? getImdbRating(item.id) : undefined}
          imdbVotes={getImdbVotes ? getImdbVotes(item.id) : undefined}
        />
      ))}
    </div>
  );
};

export default LibraryGrid;
