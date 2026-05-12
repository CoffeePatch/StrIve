import React from "react";
import { useNavigate } from "react-router-dom";

const MovieCard = ({
  movie,
  onRemove,
  minimal = false,
  vaultMode = false,
  enableImdb = true,
  cardSize = "default",
}) => {
  const navigate = useNavigate();
  const displayYear =
    movie.releaseYear ||
    movie.release_date?.split("-")[0] ||
    movie.first_air_date?.split("-")[0] ||
    "N/A";

  const cardWidthClass = cardSize === "compact" ? "w-44" : "w-52";

  const imdbScore = Number(movie?.ratings?.imdbScore);
  const imdbVotes = Number(movie?.ratings?.imdbVotes || 0);
  const hasImdbScore = Number.isFinite(imdbScore) && imdbScore > 0;

  const displayRating = enableImdb && hasImdbScore
    ? {
        score: imdbScore,
        votes: imdbVotes,
      }
    : null;

  const formatVotes = (votes) => {
    if (votes >= 1000000) return `${(votes / 1000000).toFixed(1)}M`;
    if (votes >= 1000) return `${(votes / 1000).toFixed(1)}K`;
    return votes;
  };

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

  if (vaultMode) {
    return (
      <div
        className="cursor-pointer group transition-all duration-200 hover:scale-105 relative"
        onClick={handleCardClick}
      >
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

          {enableImdb && displayRating && displayRating.score && (
            <div className="absolute top-2 right-2 bg-black/90 backdrop-blur-md px-2 py-1 rounded flex items-center gap-1.5 border border-yellow-500/50 shadow-lg z-10 animate-in">
              <span className="text-yellow-400 text-xs font-bold">IMDb</span>
              <span className="text-white text-xs font-bold">{displayRating.score.toFixed(1)}</span>
              {displayRating.votes > 0 && (
                <>
                  <span className="text-white/40 text-xs">•</span>
                  <span className="text-white/70 text-[10px]">{formatVotes(displayRating.votes)}</span>
                </>
              )}
            </div>
          )}

          {onRemove && (
            <button
              className="absolute top-1 left-1 p-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200 text-yellow-400 hover:text-red-500 z-10"
              onClick={handleRemoveClick}
              aria-label="Remove from list"
            >
              <span className="material-symbols-outlined text-xs">delete</span>
            </button>
          )}

          <div className="absolute inset-0 border-2 border-transparent group-hover:border-white/30 rounded-sm transition-all duration-200 pointer-events-none"></div>
        </div>

        <div className="mt-2 px-0.5">
          <h3 className="text-white text-xs font-medium truncate leading-tight">
            {movie.title || movie.name}
          </h3>

          <div className="flex justify-between items-center mt-1">
            <span className="text-gray-400 text-xs">
              {displayYear}
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

  return (
    <div
      className={`flex-none ${cardWidthClass} cursor-pointer group transition-all duration-300`}
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
          className="w-full aspect-[2/3] object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
        />

        {enableImdb && displayRating && displayRating.score && !minimal && (
          <div className="absolute top-3 left-3 z-20">
            <div className="bg-black/90 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-yellow-500/50 shadow-lg">
              <span className="text-yellow-400 text-xs font-bold">IMDb</span>
              <span className="text-white text-sm font-bold">{displayRating.score.toFixed(1)}</span>
              {displayRating.votes > 0 && (
                <>
                  <span className="text-white/40 text-xs">•</span>
                  <span className="text-white/70 text-[11px]">{formatVotes(displayRating.votes)}</span>
                </>
              )}
            </div>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-full p-4 transform scale-90 group-hover:scale-100 transition-transform duration-300">
              <span className="material-symbols-outlined text-5xl text-white">
                play_circle
              </span>
            </div>
          </div>
        </div>

        {onRemove && (
          <button
            className="absolute top-3 left-3 p-2 cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300 text-yellow-400 hover:text-red-500 z-10"
            onClick={handleRemoveClick}
            aria-label="Remove from list"
          >
            <span className="material-symbols-outlined text-lg">delete</span>
          </button>
        )}
      </div>

      {!minimal && (
        <div className="mt-3 px-1">
          <h3 className="text-white text-sm font-semibold font-secondary truncate group-hover:text-red-400 transition-colors">
            {movie.title || movie.name}
          </h3>
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1 text-white/60">
              <span className="text-xs font-medium">{displayYear}</span>
              <span className="text-white/40">•</span>
              <span className="material-symbols-outlined text-white/60 text-xs">
                {movie.media_type === "tv" || movie.first_air_date ? "tv" : "movie"}
              </span>
              <span className="text-xs font-medium">{movie.media_type === "tv" || movie.first_air_date ? "Series" : "Film"}</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-yellow-400 text-sm">star</span>
              <span className="text-yellow-400 text-xs font-semibold">{movie.vote_average?.toFixed(1)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MovieCard;
