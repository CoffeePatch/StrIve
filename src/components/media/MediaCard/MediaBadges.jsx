import React from "react";

export const MediaBadges = ({ media, enableImdb = true, vaultMode = false }) => {
  const { rating } = media;
  const imdbScore = rating?.imdbScore;
  const imdbVotes = rating?.imdbVotes || 0;
  const hasImdbScore = Number.isFinite(imdbScore) && imdbScore > 0;

  if (!enableImdb || !hasImdbScore) return null;

  const formatVotes = (votes) => {
    if (votes >= 1000000) return `${(votes / 1000000).toFixed(1)}M`;
    if (votes >= 1000) return `${(votes / 1000).toFixed(1)}K`;
    return votes;
  };

  const baseClasses = vaultMode
    ? "absolute top-2 right-2 bg-black/90 backdrop-blur-md px-2 py-1 rounded flex items-center gap-1.5 border border-yellow-500/50 shadow-lg z-10 animate-in"
    : "absolute top-3 left-3 z-20 animate-in bg-black/90 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-1.5 border border-yellow-500/50 shadow-lg";

  return (
    <div className={baseClasses}>
      <span className="text-yellow-400 text-xs font-bold">IMDb</span>
      <span className={`text-white font-bold ${vaultMode ? "text-xs" : "text-sm"}`}>
        {imdbScore.toFixed(1)}
      </span>
      {imdbVotes > 0 && (
        <>
          <span className="text-white/40 text-xs">•</span>
          <span className={`text-white/70 ${vaultMode ? "text-[10px]" : "text-[11px]"}`}>
            {formatVotes(imdbVotes)}
          </span>
        </>
      )}
    </div>
  );
};
