import React from 'react';

const MediaGenres = ({ genres }) => {
  if (!genres || genres.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 lg:gap-3">
      {genres.map((genre) => (
        <span
          key={genre.id}
          className="px-3 py-1.5 lg:px-4 lg:py-2 rounded-full text-sm font-secondary"
          style={{
            backgroundColor: 'var(--color-bg-elevated, rgba(255,255,255,0.1))',
            color: 'var(--color-text-secondary, rgba(255,255,255,0.8))',
            backdropFilter: 'blur(10px)' // glass-effect from movies
          }}
        >
          {genre.name}
        </span>
      ))}
    </div>
  );
};

export default MediaGenres;
