import React from "react";

export const MediaMetadata = ({ media, vaultMode = false }) => {
  if (vaultMode) {
    return (
      <div className="mt-2 px-0.5">
        <h3 className="text-white text-xs font-medium truncate leading-tight">
          {media.title}
        </h3>
        <div className="flex justify-between items-center mt-1">
          <span className="text-gray-400 text-xs">{media.releaseYear}</span>
          <div className="flex items-center gap-0.5">
            <span className="material-symbols-outlined text-yellow-400" style={{ fontSize: "12px" }}>star</span>
            <span className="text-yellow-400 text-xs font-semibold">
              {media.rating?.score ? media.rating.score.toFixed(1) : "N/A"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 px-1">
      <h3 className="text-white text-sm font-semibold font-secondary truncate group-hover:text-red-400 transition-colors">
        {media.title}
      </h3>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1 text-white/60">
          <span className="text-xs font-medium">{media.releaseYear}</span>
          <span className="text-white/40">•</span>
          <span className="material-symbols-outlined text-white/60 text-xs">
            {media.mediaType === "tv" ? "tv" : "movie"}
          </span>
          <span className="text-xs font-medium">
            {media.mediaType === "tv" ? "Series" : "Film"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="material-symbols-outlined text-yellow-400 text-sm">star</span>
          <span className="text-yellow-400 text-xs font-semibold">
            {media.rating?.score ? media.rating.score.toFixed(1) : "N/A"}
          </span>
        </div>
      </div>
    </div>
  );
};
