import React from "react";
import { useNavigate } from "react-router-dom";
import { useImdbRating } from "../hooks/useImdbRating";

const MovieCard = ({ movie, onRemove, minimal = false, vaultMode = false }) => {
  const navigate = useNavigate();
  
  // Fetch IMDb rating for "just-in-time" enrichment
  const { rating, loading } = useImdbRating(movie.id, movie.media_type || (movie.first_air_date ? 'tv' : 'movie'));

  const formatVotes = (votes) => {
    if (votes >= 1000000) return `${(votes / 1000000).toFixed(1)}M`;
    if (votes >= 1000) return `${(votes / 1000).toFixed(1)}K`;
    return votes;
  };

  // if (!movie.poster_path || movie.poster_path.trim() === "") return null;

  const handleCardClick = () => {
    const isTVShow = movie.media_type === "tv" || movie.first_air_date;
    if (isTVShow) {
      navigate(`/shows/${movie.id}`);
    } else {
      navigate(`/movie/${movie.id}`);
    }
  };

  const handleRemoveClick = (e) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove(movie);
    }
  };

  // Vault Mode: Poster + Footer Layout
  if (vaultMode) {
    return (
      <div
        className="cursor-pointer group transition-all duration-200 hover:scale-105 relative"
        onClick={handleCardClick}
      >
        {/* Poster */}
        <div className="relative overflow-hidden rounded-sm aspect-[2/3]">
          <img
            src={
              movie.poster_path
                ? movie.poster_path.startsWith("http")
                  ? movie.poster_path
                  : `https://image.tmdb.org/t/p/w342${movie.poster_path}`
                : "https://placehold.co/342x513/202020/606060?text=No+Poster"
            }
            alt={movie.title || movie.name}
            className="w-full h-full object-cover"
          />

          {/* IMDb Rating Badge Skeleton (Loading State) */}
          {loading && !rating && (
            <div className="absolute top-2 right-2 bg-black/90 backdrop-blur-md px-2 py-1 rounded flex items-center gap-1.5 border border-yellow-500/20 shadow-lg z-10">
              <div className="skeleton-badge"></div>
            </div>
          )}

          {/* IMDb Rating Badge */}
          {rating && rating.score && (
            <div className="absolute top-2 right-2 bg-black/90 backdrop-blur-md px-2 py-1 rounded flex items-center gap-1.5 border border-yellow-500/50 shadow-lg z-10 animate-in">
              <span className="text-yellow-400 text-xs font-bold">IMDb</span>
              <span className="text-white text-xs font-bold">{rating.score.toFixed(1)}</span>
              {rating.votes > 0 && (
                <>
                  <span className="text-white/40 text-xs">•</span>
                  <span className="text-white/70 text-[10px]">{formatVotes(rating.votes)}</span>
                </>
              )}
            </div>
          )}

          {/* Remove Button */}
          {onRemove && (
            <button
              className="absolute top-1 right-1 bg-black/90 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600 z-10"
              onClick={handleRemoveClick}
              aria-label="Remove from list"
            >
              <span className="material-symbols-outlined text-white text-xs">
                close
              </span>
            </button>
          )}

          {/* White border on hover (not white background) */}
          <div className="absolute inset-0 border-2 border-transparent group-hover:border-white/30 rounded-sm transition-all duration-200 pointer-events-none"></div>
        </div>

        {/* Info Footer */}
        <div className="mt-2 px-0.5">
          {/* Title */}
          <h3 className="text-white text-xs font-medium truncate leading-tight">
            {movie.title || movie.name}
          </h3>

          {/* Metadata Row */}
          <div className="flex justify-between items-center mt-1">
            <span className="text-gray-400 text-xs">
              {(movie.release_date || movie.first_air_date)?.split("-")[0] ||
                "N/A"}
            </span>
            <div className="flex items-center gap-0.5">
              <span
                className="material-symbols-outlined text-yellow-400"
                style={{ fontSize: "12px" }}
              >
                star
              </span>
              <span className="text-yellow-400 text-xs font-semibold">
                {movie.vote_average?.toFixed(1) || "N/A"}
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Original Mode
  return (
    <div
      className="flex-none w-52 cursor-pointer group transition-all duration-300"
      onClick={handleCardClick}
    >
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <img
          src={
            movie.poster_path
              ? movie.poster_path.startsWith("http")
                ? movie.poster_path
                : `https://image.tmdb.org/t/p/w500${movie.poster_path}`
              : "https://placehold.co/500x750/202020/606060?text=No+Poster"
          }
          alt={movie.title || movie.name}
          className="w-full h-[312px] object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
        />

        {/* IMDb Rating Badge - Top Left, Always Visible */}
        {rating && rating.score && !minimal && (
          <div className="absolute top-3 left-3 z-20">
            <div className="bg-black/90 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-yellow-500/50 shadow-lg">
              <span className="text-yellow-400 text-xs font-bold">IMDb</span>
              <span className="text-white text-sm font-bold">{rating.score.toFixed(1)}</span>
              {rating.votes > 0 && (
                <>
                  <span className="text-white/40 text-xs">•</span>
                  <span className="text-white/70 text-[11px]">{formatVotes(rating.votes)}</span>
                </>
              )}
            </div>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="glass-effect rounded-full p-4 transform scale-90 group-hover:scale-100 transition-transform duration-300">
              <span className="material-symbols-outlined text-5xl text-white">
                play_circle
              </span>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h3 className="text-white text-sm font-semibold font-secondary mb-2 line-clamp-2">
              {movie.title || movie.name}
            </h3>
            <div className="flex items-center justify-between gap-2">
              <div className="glass-effect px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <span className="material-symbols-outlined text-yellow-400 text-sm">
                  star
                </span>
                <span className="text-white font-semibold text-sm font-secondary">
                  {movie.vote_average?.toFixed(1)}
                </span>
              </div>
              <div className="glass-effect px-3 py-1.5 rounded-full">
                <span className="text-white text-xs font-bold font-secondary tracking-wide">
                  HD
                </span>
              </div>
            </div>
          </div>
        </div>

        {onRemove && (
          <button
            className="absolute top-3 right-3 bg-red-600/90 backdrop-blur-sm p-2 rounded-full cursor-pointer opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-red-700 hover:scale-110 z-10"
            onClick={handleRemoveClick}
            aria-label="Remove from list"
          >
            <span className="material-symbols-outlined text-white text-lg">
              delete
            </span>
          </button>
        )}
      </div>

      {!minimal && (
        <div className="mt-3 px-1">
          <h3 className="text-white text-sm font-semibold font-secondary truncate group-hover:text-red-400 transition-colors">
            {movie.title || movie.name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-white/60 text-xs font-medium">
              {(movie.release_date || movie.first_air_date)?.split("-")[0]}
            </p>
            <span className="text-white/40">•</span>
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-white/60 text-xs">
                {movie.media_type === "tv" || movie.first_air_date
                  ? "tv"
                  : "movie"}
              </span>
              <p className="text-white/60 text-xs font-medium">
                {movie.media_type === "tv" || movie.first_air_date
                  ? "Series"
                  : "Film"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MovieCard;
