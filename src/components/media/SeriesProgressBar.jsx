import React from "react";
import { TrendingUp } from "lucide-react";
import useSeriesProgress from "../../hooks/tv/useSeriesProgress";

const percentLabel = (ratio) => `${Math.round((ratio || 0) * 100)}%`;

/**
 * Renders progress from a single denormalized series_progress doc.
 * Premium design with gradient bar, glow on progress, and smart empty state.
 */
const SeriesProgressBar = ({ userId, titleKey, realtime = true, className = "", override = null }) => {
  const {
    loading,
    error,
    progress,
    watchedEpisodesCount,
    airedEpisodesCount,
    completionRatioAired,
  } = useSeriesProgress({ userId, titleKey, realtime });

  const displayWatched =
    typeof override?.watchedEpisodesCount === "number"
      ? override.watchedEpisodesCount
      : watchedEpisodesCount;
  const displayAired =
    typeof override?.airedEpisodesCount === "number"
      ? override.airedEpisodesCount
      : airedEpisodesCount;
  const displayRatio =
    typeof override?.completionRatioAired === "number"
      ? override.completionRatioAired
      : (displayAired > 0 ? displayWatched / displayAired : completionRatioAired);
  const isSyncing = Boolean(override?.isSyncing);

  if (!userId || !titleKey) return null;

  if (loading) {
    return (
      <div className={`w-full ${className}`}>
        <div className="series-progress-bar">
          <div className="h-1.5 w-full rounded-full bg-white/8 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) return null;

  // Smart empty state: show minimal bar when no progress exists yet
  const hasProgress = (progress || override) && displayWatched > 0;
  const isComplete = displayRatio >= 1 && displayAired > 0;
  const pct = percentLabel(displayRatio);

  return (
    <div className={`w-full ${className}`}>
      <div className="series-progress-bar">
        {/* Labels row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className={`w-3.5 h-3.5 ${hasProgress ? 'text-success' : 'text-muted'}`} />
            <span className={`text-xs font-medium ${hasProgress ? 'text-secondary' : 'text-muted'}`}>
              {hasProgress
                ? `${displayWatched} of ${displayAired} aired episodes watched`
                : 'No episodes tracked yet'}
            </span>
            {hasProgress && isSyncing && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-400/15 text-yellow-300 border border-yellow-400/30">
                Syncing...
              </span>
            )}
          </div>
          {hasProgress && (
            <span className={`text-xs font-bold ${isComplete ? 'text-success' : 'text-secondary'}`}>
              {pct}
            </span>
          )}
        </div>

        {/* Progress bar track */}
        <div className="series-progress-track">
          <div
            className={`series-progress-fill ${isComplete ? 'series-progress-fill--complete' : ''}`}
            style={{ width: hasProgress ? pct : '0%' }}
            role="progressbar"
            aria-valuenow={Math.round(displayRatio * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Series watch progress"
          />
        </div>
      </div>
    </div>
  );
};

export default SeriesProgressBar;
