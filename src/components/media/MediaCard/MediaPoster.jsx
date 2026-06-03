import React from "react";
import { IMG_CDN_URL } from "../../../util/core/constants";

export const MediaPoster = ({ media, vaultMode = false, onRemove, children }) => {
  const fallbackPoster = vaultMode
    ? "https://placehold.co/342x513/202020/606060?text=No+Poster"
    : "https://placehold.co/500x750/202020/606060?text=No+Poster";

  let finalPoster = fallbackPoster;
  if (media.posterPath) {
    if (media.posterPath.startsWith("http")) {
      finalPoster = media.posterPath;
    } else {
      finalPoster = vaultMode 
        ? `https://image.tmdb.org/t/p/w342${media.posterPath}`
        : `${IMG_CDN_URL}${media.posterPath}`;
    }
  }

  const handleRemoveClick = (e) => {
    e.stopPropagation();
    if (onRemove) {
      // Pass the raw data if available for compatibility with older code, or the media object
      onRemove(media.raw || media);
    }
  };

  if (vaultMode) {
    return (
      <div className="relative overflow-hidden rounded-sm aspect-[2/3]">
        <img
          src={finalPoster}
          alt={media.title}
          className="w-full h-full object-cover"
        />

        {children}

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
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl shadow-lg">
      <img
        src={finalPoster}
        alt={media.title}
        className="w-full aspect-[2/3] object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
      />

      {children}

      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 z-10">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="rounded-full p-4 transform scale-90 group-hover:scale-100 transition-transform duration-300">
            <span className="material-symbols-outlined text-5xl text-white">play_circle</span>
          </div>
        </div>
      </div>

      {onRemove && (
        <button
          className="absolute top-3 left-3 p-2 cursor-pointer opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all duration-300 text-yellow-400 hover:text-red-500 z-20"
          onClick={handleRemoveClick}
          aria-label="Remove from list"
        >
          <span className="material-symbols-outlined text-lg">delete</span>
        </button>
      )}
    </div>
  );
};
