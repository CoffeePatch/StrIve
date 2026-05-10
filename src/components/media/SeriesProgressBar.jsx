import React from "react";
import useSeriesProgress from "../../hooks/tv/useSeriesProgress";

const percentLabel = (ratio) => `${Math.round((ratio || 0) * 100)}%`;

/**
 * Renders progress from a single denormalized series_progress doc.
 */
const SeriesProgressBar = ({ userId, titleKey, realtime = true, className = "" }) => {
  const {
    loading,
    error,
    watchedEpisodesCount,
    airedEpisodesCount,
    completionRatioAired,
  } = useSeriesProgress({ userId, titleKey, realtime });

  if (!userId || !titleKey) return null;

  if (loading) {
    return (
      <div className={`w-full ${className}`}>
        <div className="text-xs text-white/60 mb-2">Loading progress...</div>
        <div className="h-2 w-full rounded bg-white/10 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`w-full ${className}`}>
        <div className="text-xs text-red-300">Progress unavailable</div>
      </div>
    );
  }

  return (
    <div className={`w-full ${className}`}>
      <div className="flex items-center justify-between mb-2 text-xs text-white/70">
        <span>
          {watchedEpisodesCount}/{airedEpisodesCount} aired episodes
        </span>
        <span>{percentLabel(completionRatioAired)}</span>
      </div>
      <div className="h-2 w-full rounded bg-white/10 overflow-hidden">
        <div
          className="h-full bg-green-500 transition-all duration-300"
          style={{ width: percentLabel(completionRatioAired) }}
          aria-label="Series watch progress"
        />
      </div>
    </div>
  );
};

export default SeriesProgressBar;
