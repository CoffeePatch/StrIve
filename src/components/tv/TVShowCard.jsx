import React from "react";
import { useNavigate } from "react-router-dom";
import { IMG_CDN_URL } from "../../util/core/constants";
import { normalizeWatchStatus } from "../../util/library/watchStatus";

const TVShowCard = ({
  tvShow,
  show,
  onRemove,
  vaultMode = false,
  enableImdb = true,
  cardSize = "default",
}) => {
  const navigate = useNavigate();
  const [imageLoaded, setImageLoaded] = React.useState(false);
  const [imageError, setImageError] = React.useState(false);

  const cardWidthClass = cardSize === "compact" ? "w-44" : "w-52";
  const data = show || tvShow;
  const displayYear =
    data.releaseDate?.split("-")[0] ||
    data.first_air_date?.split("-")[0] ||
    data.release_date?.split("-")[0] ||
    "N/A";

  const imdbScore = Number(data?.ratings?.imdbScore);
  const imdbVotes = Number(data?.ratings?.imdbVotes || 0);
  const hasImdbScore = Number.isFinite(imdbScore) && imdbScore > 0;

  const nextToWatch = data?.tvProgress?.nextToWatch || null;
  const nextSeasonNumber = Number(nextToWatch?.seasonNumber);
  const nextEpisodeNumber = Number(nextToWatch?.episodeNumber);
  const hasNextEpisode = Number.isInteger(nextSeasonNumber) && Number.isInteger(nextEpisodeNumber);
  const normalizedStatus = normalizeWatchStatus(
    data?.tracking?.watchStatus ?? data?.watchStatus ?? data?.status
  );
  const shouldDefaultNext = !hasNextEpisode && (normalizedStatus === "plan_to_watch" || normalizedStatus === "watching" || !normalizedStatus);
  const nextEpisodeLabel = hasNextEpisode
    ? `S${nextSeasonNumber}E${nextEpisodeNumber}`
    : (shouldDefaultNext ? "S1E1" : null);

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

  const hasPoster = data.poster_path && data.poster_path !== "";

  const handleClick = () => {
    navigate(`/shows/${data.id}`);
  };

  const handleRemoveClick = (e) => {
    e.stopPropagation();
    if (onRemove) {
      onRemove(data);
    }
  };

  if (vaultMode) {
    return (
      <div
        className="cursor-pointer group transition-all duration-200 hover:scale-105 relative"
        onClick={handleClick}
      >
        <div className="relative overflow-hidden rounded-sm aspect-[2/3] bg-gray-800/40">
          {hasPoster && !imageError ? (
            <>
              <img
                src={
                  data.poster_path.startsWith("http")
                    ? data.poster_path
                    : `https://image.tmdb.org/t/p/w342${data.poster_path}`
                }
                alt={data.name}
                className={`w-full h-full object-cover transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
              {!imageLoaded && (
                <div className="absolute inset-0 bg-gray-800/80 animate-pulse flex items-center justify-center">
                  <span className="material-symbols-outlined text-white/15 text-lg animate-bounce">live_tv</span>
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 bg-white/5 flex flex-col items-center justify-center p-2 text-center">
              <span className="material-symbols-outlined text-white/20 text-lg mb-1">live_tv</span>
              <span className="text-[10px] text-white/40 font-secondary line-clamp-3 leading-tight">{data.name}</span>
            </div>
          )}

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

          {nextEpisodeLabel && (
            <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <div className="bg-black/75 border border-white/10 rounded px-2 py-1 text-[11px] text-white/90">
                Next: {nextEpisodeLabel}
              </div>
            </div>
          )}

          <div className="absolute inset-0 border-2 border-transparent group-hover:border-white/30 rounded-sm transition-all duration-200 pointer-events-none"></div>
        </div>

        <div className="mt-2 px-0.5">
          <h3 className="text-white text-xs font-medium truncate leading-tight">{data.name}</h3>
          <div className="flex justify-between items-center mt-1">
            <span className="text-gray-400 text-xs">{displayYear}</span>
            <div className="flex items-center gap-0.5">
              <span className="material-symbols-outlined text-yellow-400" style={{ fontSize: "12px" }}>star</span>
              <span className="text-yellow-400 text-xs font-semibold">{data.vote_average?.toFixed(1) || "N/A"}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-none ${cardWidthClass} cursor-pointer group transition-all duration-300`} onClick={handleClick}>
      <div className="relative overflow-hidden rounded-2xl shadow-lg aspect-[2/3] bg-gray-800/40">
        {hasPoster && !imageError ? (
          <>
            <img
              src={
                data.poster_path.startsWith("http")
                  ? data.poster_path
                  : `${IMG_CDN_URL}${data.poster_path}`
              }
              alt={data.name}
              className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
            {!imageLoaded && (
              <div className="absolute inset-0 bg-gray-800/80 animate-pulse flex items-center justify-center">
                <span className="material-symbols-outlined text-white/15 text-2xl animate-bounce">live_tv</span>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 bg-white/5 flex flex-col items-center justify-center p-3 text-center border border-white/5 rounded-2xl">
            <span className="material-symbols-outlined text-white/20 text-3xl mb-2">live_tv</span>
            <span className="text-xs text-white/50 font-secondary line-clamp-3 px-1 leading-tight font-medium">{data.name}</span>
          </div>
        )}

        {enableImdb && displayRating && displayRating.score && (
          <div className="absolute top-3 left-3 z-20 animate-in">
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

        {hasPoster && !imageError && imageLoaded && (
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="rounded-full p-4 transform scale-90 group-hover:scale-100 transition-transform duration-300">
                <span className="material-symbols-outlined text-5xl text-white">play_circle</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 px-1">
        <h3 className="text-white text-sm font-semibold font-secondary truncate group-hover:text-red-400 transition-colors">{data.name}</h3>
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-1 text-white/60">
            <span className="text-xs font-medium">{displayYear}</span>
            <span className="text-white/40">•</span>
            <span className="material-symbols-outlined text-white/60 text-xs">tv</span>
            <span className="text-xs font-medium">Series</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="material-symbols-outlined text-yellow-400 text-sm">star</span>
            <span className="text-yellow-400 text-xs font-semibold">{data.vote_average?.toFixed(1)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TVShowCard;
