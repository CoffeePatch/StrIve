import { useState } from 'react';
import { Film } from 'lucide-react';

function getPosterUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/w342${path}`;
}

export default function PosterCollage({ items = [], className = '' }) {
  // Extract up to 4 poster paths from items array
  const posters = items
    .map(i => i?.catalog?.posterPath || i?.posterPath || i?.catalog?.backdropPath)
    .filter(Boolean)
    .slice(0, 4);

  const count = posters.length;

  if (count === 0) {
    return (
      <div className={`w-full aspect-[16/9] sm:aspect-[3/2] bg-backdrop/80 border border-border-subtle rounded-xl flex flex-col items-center justify-center text-muted p-4 ${className}`}>
        <div className="w-12 h-12 rounded-full bg-surface-hover flex items-center justify-center mb-2">
          <Film className="w-6 h-6 text-muted" />
        </div>
        <span className="text-[12px] font-secondary font-medium">Empty List</span>
      </div>
    );
  }

  if (count === 1) {
    return (
      <div className={`w-full aspect-[16/9] sm:aspect-[3/2] rounded-xl overflow-hidden relative border border-border-subtle bg-backdrop ${className}`}>
        <CollageImage src={posters[0]} className="w-full h-full object-cover" />
      </div>
    );
  }

  if (count === 2) {
    return (
      <div className={`w-full aspect-[16/9] sm:aspect-[3/2] rounded-xl overflow-hidden grid grid-cols-2 gap-0.5 border border-border-subtle bg-backdrop ${className}`}>
        <CollageImage src={posters[0]} className="w-full h-full object-cover" />
        <CollageImage src={posters[1]} className="w-full h-full object-cover" />
      </div>
    );
  }

  if (count === 3) {
    return (
      <div className={`w-full aspect-[16/9] sm:aspect-[3/2] rounded-xl overflow-hidden grid grid-cols-2 gap-0.5 border border-border-subtle bg-backdrop ${className}`}>
        <CollageImage src={posters[0]} className="w-full h-full object-cover" />
        <div className="grid grid-rows-2 gap-0.5 h-full">
          <CollageImage src={posters[1]} className="w-full h-full object-cover" />
          <CollageImage src={posters[2]} className="w-full h-full object-cover" />
        </div>
      </div>
    );
  }

  // 4+ posters: 2x2 grid
  return (
    <div className={`w-full aspect-[16/9] sm:aspect-[3/2] rounded-xl overflow-hidden grid grid-cols-2 grid-rows-2 gap-0.5 border border-border-subtle bg-backdrop ${className}`}>
      {posters.slice(0, 4).map((url, idx) => (
        <CollageImage key={idx} src={url} className="w-full h-full object-cover" />
      ))}
    </div>
  );
}

function CollageImage({ src, className }) {
  const [error, setError] = useState(false);
  const fullUrl = getPosterUrl(src);

  if (error || !fullUrl) {
    return (
      <div className={`bg-surface-hover flex items-center justify-center ${className}`}>
        <Film className="w-4 h-4 text-muted/50" />
      </div>
    );
  }

  return (
    <img
      src={fullUrl}
      alt="Collage Poster"
      loading="lazy"
      onError={() => setError(true)}
      className={className}
    />
  );
}
