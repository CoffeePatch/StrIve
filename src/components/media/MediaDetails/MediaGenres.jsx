import React from 'react';

const MediaGenres = ({ genres }) => {
  if (!genres || genres.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 lg:gap-3">
      {genres.map((genre) => (
        <span
          key={genre.id}
          className="px-3 py-1 lg:px-4 lg:py-1.5 rounded-full text-[13px] lg:text-[14px] font-medium bg-white/5 border border-white/10 text-white/80 backdrop-blur-md shadow-sm"
        >
          {genre.name}
        </span>
      ))}
    </div>
  );
};

export default MediaGenres;
