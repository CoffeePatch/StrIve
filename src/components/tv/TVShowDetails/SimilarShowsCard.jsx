import React from "react";
import { useNavigate } from "react-router-dom";
import { Star } from "lucide-react";

const IMG_CDN_URL = "https://image.tmdb.org/t/p";

const SimilarShowsCard = ({ show }) => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/shows/${show.id}`);
    window.scrollTo(0, 0);
  };

  return (
    <div
      onClick={handleClick}
      className="group cursor-pointer transition-all duration-200 hover:scale-105 focus-accent"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label={`View ${show.name}`}
    >
      <div className="relative w-full aspect-[2/3] rounded-lg overflow-hidden mb-2" style={{ backgroundColor: 'var(--color-bg-surface)' }}>
        {show.posterPath ? (
          <img
            src={`${IMG_CDN_URL}/w342${show.posterPath}`}
            alt={show.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-4xl" style={{ color: 'var(--color-text-tertiary)' }}>📺</span>
          </div>
        )}

        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
          <span className="text-white text-sm font-semibold px-3 py-1 rounded" style={{ backgroundColor: 'var(--color-accent-primary)' }}>View Details</span>
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold mb-1 line-clamp-2 min-h-[2.5rem]" style={{ color: 'var(--color-text-primary)' }}>
          {show.name}
        </h4>

        <div className="flex items-center justify-between text-xs">
          {show.firstAirDate && (
            <span style={{ color: 'var(--color-text-tertiary)' }}>
              {new Date(show.firstAirDate).getFullYear()}
            </span>
          )}
          {show.voteAverage > 0 && (
            <div className="flex items-center gap-1">
              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
              <span style={{ color: 'var(--color-text-secondary)' }}>{show.voteAverage.toFixed(1)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimilarShowsCard;
