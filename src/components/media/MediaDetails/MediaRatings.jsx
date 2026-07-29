import React from 'react';

const formatCount = (num) => {
  if (num === null || num === undefined) return null;
  const value = typeof num === 'number' ? num : Number(num);
  if (!Number.isFinite(value)) return null;
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return `${value}`;
};

const MediaRatings = ({ layoutType = "movie", imdbRating, imdbVotes, imdbLoading, tmdbScore, tmdbVotes }) => {
  if (layoutType === "tv") {
    return (
      <div className="flex flex-row items-center gap-3">
        {/* TMDB Rating Pill */}
        <div 
          className="flex flex-row items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-surface/50 backdrop-blur shadow-sm"
          aria-label={`TMDB rating ${tmdbScore ? tmdbScore.toFixed(1) : 'N/A'} out of 10, based on ${tmdbVotes || 0} votes`}
        >
          <span className="bg-gradient-to-r from-[#90CEA1] to-[#01B4E4] text-black text-[10px] font-black px-1.5 rounded-sm tracking-tighter leading-tight" style={{ paddingTop: '2px', paddingBottom: '2px' }}>
            TMDB
          </span>
          {tmdbScore ? (
            <>
              <span className="text-primary text-sm font-bold">{tmdbScore.toFixed(1)}</span>
              {tmdbVotes ? (
                <span className="text-muted text-xs">({formatCount(tmdbVotes)})</span>
              ) : null}
            </>
          ) : (
            <span className="text-xs text-muted">N/A</span>
          )}
        </div>

        {/* IMDb Rating Pill */}
        {imdbRating && (
          <div 
            className="flex flex-row items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-surface/50 backdrop-blur shadow-sm"
            aria-label={`IMDb rating ${imdbRating} out of 10, based on ${imdbVotes || 0} votes`}
          >
            <span className="bg-[#F5C518] text-black text-[10px] font-black px-1.5 rounded-sm tracking-tighter leading-tight" style={{ paddingTop: '2px', paddingBottom: '2px' }}>
              IMDb
            </span>
            <span className="text-primary text-sm font-bold">{imdbRating}</span>
            {imdbVotes ? (
              <span className="text-muted text-xs">({formatCount(imdbVotes)})</span>
            ) : null}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="bg-surface/80 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-yellow-500/50 shadow-lg">
        <span className="text-yellow-500 text-xs font-bold">
          IMDb
        </span>
        {imdbLoading ? (
          <div className="h-4 w-16 rounded animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}></div>
        ) : imdbRating ? (
          <>
            <span className="text-primary text-sm font-bold">
              {imdbRating}
            </span>
            {imdbVotes ? (
              <>
                <span className="text-muted text-xs">•</span>
                <span className="text-secondary text-xs">{formatCount(imdbVotes)}</span>
              </>
            ) : null}
          </>
        ) : (
          <span className="text-xs text-muted">N/A</span>
        )}
      </div>

      <div className="bg-surface/80 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-blue-500/40 shadow-lg">
        <span className="text-blue-500 text-xs font-bold">TMDB</span>
        {tmdbScore ? (
          <>
            <span className="text-primary text-sm font-bold">
              {tmdbScore.toFixed(1)}
            </span>
            {tmdbVotes ? (
              <>
                <span className="text-muted text-xs">•</span>
                <span className="text-secondary text-xs">{formatCount(tmdbVotes)}</span>
              </>
            ) : null}
          </>
        ) : (
          <span className="text-xs text-muted">N/A</span>
        )}
      </div>
    </div>
  );
};

export default MediaRatings;
