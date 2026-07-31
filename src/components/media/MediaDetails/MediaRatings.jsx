import React from 'react';

const formatCount = (num) => {
  if (num === null || num === undefined) return null;
  const value = typeof num === 'number' ? num : Number(num);
  if (!Number.isFinite(value) || value <= 0) return null;
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return `${value}`;
};

const parseNumericScore = (val) => {
  if (val === null || val === undefined || val === '' || val === 'N/A') return null;
  const num = typeof val === 'number' ? val : Number(String(val).replace(/,/g, ''));
  return Number.isFinite(num) && num > 0 ? num : null;
};

const MediaRatings = ({ layoutType = "movie", imdbRating, imdbVotes, imdbLoading, tmdbScore, tmdbVotes }) => {
  const validImdbScore = parseNumericScore(imdbRating);
  const validImdbVotes = parseNumericScore(imdbVotes);
  const validTmdbScore = parseNumericScore(tmdbScore);
  const validTmdbVotes = parseNumericScore(tmdbVotes);

  const showImdb = Boolean(validImdbScore || imdbLoading);
  const showTmdb = Boolean(validTmdbScore);

  if (!showImdb && !showTmdb) {
    return null;
  }

  return (
    <div className="flex flex-row items-center gap-3">
      {/* IMDb Badge */}
      {showImdb && (
        <div className="bg-surface/80 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-yellow-500/50 shadow-lg">
          <span className="bg-[#F5C518] text-black text-[10px] font-black px-1.5 rounded-sm tracking-tighter leading-tight" style={{ paddingTop: '2px', paddingBottom: '2px' }}>
            IMDb
          </span>
          {imdbLoading && !validImdbScore ? (
            <div className="h-4 w-12 rounded animate-pulse bg-white/10"></div>
          ) : (
            <>
              <span className="text-primary text-sm font-bold">
                {validImdbScore.toFixed(1)}
              </span>
              {validImdbVotes ? (
                <>
                  <span className="text-muted text-xs">•</span>
                  <span className="text-secondary text-xs">{formatCount(validImdbVotes)}</span>
                </>
              ) : null}
            </>
          )}
        </div>
      )}

      {/* TMDB Badge */}
      {showTmdb && (
        <div className="bg-surface/80 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-blue-500/40 shadow-lg">
          <span className="bg-gradient-to-r from-[#90CEA1] to-[#01B4E4] text-black text-[10px] font-black px-1.5 rounded-sm tracking-tighter leading-tight" style={{ paddingTop: '2px', paddingBottom: '2px' }}>
            TMDB
          </span>
          <span className="text-primary text-sm font-bold">
            {validTmdbScore.toFixed(1)}
          </span>
          {validTmdbVotes ? (
            <>
              <span className="text-muted text-xs">•</span>
              <span className="text-secondary text-xs">{formatCount(validTmdbVotes)}</span>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default MediaRatings;
