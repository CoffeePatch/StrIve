import React from "react";
import { TrendingUp } from "lucide-react";
import useSeriesProgress from "../../hooks/tv/useSeriesProgress";

const percentLabel = (ratio) => `${Math.round((ratio || 0) * 100)}%`;

/**
 * Renders progress from a single denormalized series_progress doc.
 * Premium design with gradient bar, glow on progress, and smart empty state.
 */
const SeriesProgressBar = ({ userId, titleKey, realtime = true, className = "" }) => {
  const {
    loading,
    error,
    progress,
    watchedEpisodesCount,
    airedEpisodesCount,
    completionRatioAired,
  } = useSeriesProgress({ userId, titleKey, realtime });

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
  const hasProgress = progress && watchedEpisodesCount > 0;
  const isComplete = completionRatioAired >= 1 && airedEpisodesCount > 0;
  const pct = percentLabel(completionRatioAired);

  return (
    <div className={`w-full ${className}`}>
      <div className="series-progress-bar">
        {/* Labels row */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5" style={{ color: hasProgress ? '#4ade80' : 'var(--color-text-tertiary)' }} />
            <span className="text-xs font-medium" style={{ color: hasProgress ? 'var(--color-text-secondary)' : 'var(--color-text-tertiary)' }}>
              {hasProgress
                ? `${watchedEpisodesCount} of ${airedEpisodesCount} aired episodes watched`
                : 'No episodes tracked yet'}
            </span>
          </div>
          {hasProgress && (
            <span className={`text-xs font-bold ${isComplete ? 'text-green-400' : 'text-white/70'}`}>
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
            aria-valuenow={Math.round(completionRatioAired * 100)}
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
