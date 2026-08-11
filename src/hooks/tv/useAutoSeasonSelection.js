import { useEffect, useRef, useCallback } from "react";

/**
 * Custom Hook: Manages intelligent season tab auto-selection on TV show mount.
 * Selects the highest watched season (maxSeason) and increments to next season if fully completed.
 * Utilizes seasonData from the active tab lazily to avoid pre-fetching all seasons.
 */
export const useAutoSeasonSelection = ({
  showDetails,
  watchedSet,
  watchedSetLoading,
  setSelectedSeason,
}) => {
  const autoSelectedRef = useRef(false);

  useEffect(() => {
    if (!showDetails || !showDetails.numberOfSeasons) return;
    if (watchedSetLoading) return; // Wait until loaded!

    if (!autoSelectedRef.current) {
      if (!watchedSet || watchedSet.size === 0) {
        autoSelectedRef.current = true;
        setSelectedSeason(1);
        return;
      }

      // Find maxSeason from watchedSet
      let maxSeason = 1;
      let maxSeasonWatchedCount = 0;
      
      for (const key of watchedSet) {
        const sn = parseInt(key.split(':')[0], 10);
        if (!isNaN(sn) && sn > maxSeason) {
          maxSeason = sn;
          maxSeasonWatchedCount = 1; // Reset count for new max
        } else if (sn === maxSeason) {
          maxSeasonWatchedCount++;
        }
      }

      // Check if maxSeason is fully watched using showDetails.seasons
      let targetSeason = maxSeason;
      if (showDetails.seasons && Array.isArray(showDetails.seasons)) {
        const maxSeasonData = showDetails.seasons.find(
          s => (s.season_number ?? s.seasonNumber) === maxSeason
        );
        
        if (maxSeasonData && maxSeasonData.episode_count) {
          if (maxSeasonWatchedCount >= maxSeasonData.episode_count && maxSeason < showDetails.numberOfSeasons) {
            targetSeason = maxSeason + 1;
          }
        }
      } else {
        // Fallback: if we can't determine episode count synchronously, don't auto-increment here
      }

      targetSeason = Math.min(targetSeason, showDetails.numberOfSeasons);
      
      // Set the target season and immediately lock to prevent race conditions
      setSelectedSeason(targetSeason);
      autoSelectedRef.current = true;
    }
  }, [showDetails, watchedSet, watchedSetLoading, setSelectedSeason]);

  const resetAutoSelection = useCallback(() => {
    autoSelectedRef.current = false;
  }, []);

  const lockAutoSelection = useCallback(() => {
    autoSelectedRef.current = true;
  }, []);

  return {
    isAutoSelected: autoSelectedRef.current,
    resetAutoSelection,
    lockAutoSelection,
  };
};

export default useAutoSeasonSelection;
