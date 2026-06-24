import { useEffect, useRef, useCallback } from "react";

/**
 * Custom Hook: Manages intelligent season tab auto-selection on TV show mount.
 * Selects the highest watched season (maxSeason) and increments to next season if fully completed.
 * Utilizes seasonData from the active tab lazily to avoid pre-fetching all seasons.
 */
export const useAutoSeasonSelection = ({
  showDetails,
  watchedSet,
  selectedSeason,
  setSelectedSeason,
  seasonData,
}) => {
  const autoSelectedRef = useRef(false);

  useEffect(() => {
    if (!showDetails || !showDetails.numberOfSeasons) return;

    if (!autoSelectedRef.current) {
      if (!watchedSet || watchedSet.size === 0) {
        autoSelectedRef.current = true;
        setSelectedSeason(1);
        return;
      }

      // Find maxSeason from watchedSet
      let maxSeason = 1;
      for (const key of watchedSet) {
        const sn = parseInt(key.split(':')[0], 10);
        if (!isNaN(sn) && sn > maxSeason) {
          maxSeason = sn;
        }
      }

      // If selectedSeason is not maxSeason yet, switch to it to load its episodes
      if (selectedSeason !== maxSeason) {
        setSelectedSeason(Math.min(maxSeason, showDetails.numberOfSeasons));
        return;
      }

      // Once selectedSeason matches maxSeason, check if the season episodes are loaded
      if (seasonData && Number(seasonData.seasonNumber) === maxSeason) {
        if (seasonData.episodes && seasonData.episodes.length > 0) {
          const allWatched = seasonData.episodes.every(ep => 
            watchedSet.has(`${maxSeason}:${ep.episodeNumber || ep.episode_number}`)
          );
          
          if (allWatched && maxSeason < showDetails.numberOfSeasons) {
            setSelectedSeason(maxSeason + 1);
          }
          autoSelectedRef.current = true; // Lock auto-selection
        }
      }
    }
  }, [showDetails, watchedSet, selectedSeason, seasonData, setSelectedSeason]);

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
