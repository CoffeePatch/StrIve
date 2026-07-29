import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import useEpisodeStates from "../../hooks/tv/useEpisodeStates";
import useMarkEpisodeWatched from "../../hooks/tv/useMarkEpisodeWatched";
import useUnwatchSeries from "../../hooks/tv/useUnwatchSeries";
import useSeriesProgress from "../../hooks/tv/useSeriesProgress";
import useRecomputeSeriesProgress from "../../hooks/tv/useRecomputeSeriesProgress";
import { libraryAdapter } from "../library/libraryAdapter";
import { buildEpisodeCatalog, selectEpisodesForMode, createEpisodeKey } from "./trackingHelpers";
import { invalidateContinueWatching } from "../../util/cache/sessionCache";
import { createLibraryIdentity } from "../library/libraryIdentity";

const SYNCING_TIMEOUT_MS = 12000;

/**
 * Domain Hook: Orchestrates TV Show tracking, progress calculation, and optimistic UI updates.
 */
export const useSeriesTracking = ({
  user,
  tvId,
  showDetails,
  allSeasonsData,
  currentSeasonEpisodes,
  fetchAllSeasonDetails,
  mediaItemForLists,
  isWatched,
  isWatchlisted,
  onError
}) => {
  const titleKey = `tmdb_tv_${tvId}`;
  const libraryIdentity = useMemo(() => createLibraryIdentity({
    titleKey,
    mediaType: "tv",
    tmdbId: tvId,
  }), [titleKey, tvId]);

  // Local State
  const [pendingProgress, setPendingProgress] = useState(null);
  const recomputeKeyRef = useRef(null);

  // Existing Tracking Hooks
  const { watchedSet, loading: watchedSetLoading, markLocallyWatched, markLocallyWatchedBulk, clearAllLocal, rollbackLocal } = useEpisodeStates({ userId: user?.uid, titleKey });
  const { markEpisodeWatched, loading: markWatchedLoading } = useMarkEpisodeWatched();
  const { unwatchSeries, loading: unwatchLoading } = useUnwatchSeries();
  const { progress: seriesProgress } = useSeriesProgress({ userId: user?.uid, titleKey, realtime: false });
  const { recomputeSeriesProgress, loading: recomputeLoading } = useRecomputeSeriesProgress();

  // 1. Automatic Recompute Logic
  useEffect(() => {
    if (!user?.uid || !titleKey) return;

    const totalFromShow = Number(
      showDetails?.numberOfEpisodes ?? showDetails?.number_of_episodes ?? 0
    );
    const progressTotal = Number(seriesProgress?.totalEpisodesCount ?? 0);
    const needsRecompute = Boolean(seriesProgress?.progressNeedsRecompute)
      || (Number.isFinite(totalFromShow)
        && totalFromShow > 0
        && progressTotal > 0
        && totalFromShow !== progressTotal)
      || (watchedSet.size > 0 && !seriesProgress);

    if (!needsRecompute || recomputeLoading) return;

    const key = `${titleKey}:${progressTotal}:${totalFromShow}:${seriesProgress?.progressNeedsRecompute ? "stale" : "mismatch"}`;
    if (recomputeKeyRef.current === key) return;
    recomputeKeyRef.current = key;

    recomputeSeriesProgress({ titleKey }).catch((err) => {
      console.warn("recomputeSeriesProgress failed:", err?.message || err);
    });
  }, [
    user?.uid,
    titleKey,
    showDetails?.numberOfEpisodes,
    showDetails?.number_of_episodes,
    seriesProgress?.totalEpisodesCount,
    seriesProgress?.progressNeedsRecompute,
    seriesProgress,
    watchedSet.size,
    recomputeLoading,
    recomputeSeriesProgress,
  ]);

  // 2. Synchronization Timeouts & Cleanup
  useEffect(() => {
    if (!pendingProgress || !seriesProgress) return;
    const serverWatched = Number(seriesProgress.watchedEpisodesCount ?? 0);
    if (serverWatched >= pendingProgress.watchedCount) {
      setPendingProgress(null);
    }
  }, [pendingProgress, seriesProgress]);

  useEffect(() => {
    if (!pendingProgress?.isSyncing) return;
    const timer = setTimeout(() => {
      setPendingProgress((prev) => {
        if (!prev || !prev.isSyncing) return prev;
        return { ...prev, isSyncing: false };
      });
    }, SYNCING_TIMEOUT_MS);

    return () => clearTimeout(timer);
  }, [pendingProgress?.isSyncing]);

  // 3. Domain Actions
  const applyWatchMode = useCallback(async (episode, mode) => {
    if (!user) throw new Error("User not authenticated.");

    const sn = Number(episode?.seasonNumber ?? episode?.season_number);
    const en = Number(episode?.episodeNumber ?? episode?.episode_number);

    if (mode !== "all" && (!Number.isInteger(sn) || !Number.isInteger(en))) {
      throw new Error("Episode metadata is invalid.");
    }

    // Fetch full catalog if not loaded and required
    let fullCatalogData = allSeasonsData;
    if (!fullCatalogData || fullCatalogData.length === 0 || (showDetails?.numberOfSeasons && fullCatalogData.length < showDetails.numberOfSeasons)) {
      fullCatalogData = await fetchAllSeasonDetails();
    }

    const catalog = buildEpisodeCatalog(fullCatalogData, currentSeasonEpisodes);
    if (!catalog.length) {
      throw new Error("Episode metadata is unavailable.");
    }

    let selected = [];
    selected = selectEpisodesForMode(catalog, mode, sn, en);

    const optimisticSet = new Set(watchedSet);
    selected.forEach((ep) => {
      optimisticSet.add(createEpisodeKey(ep.seasonNumber, ep.episodeNumber));
    });

    const backupSet = new Set(watchedSet);
    const backupProgress = pendingProgress ? { ...pendingProgress } : null;

    if (selected.length === 1) {
      markLocallyWatched(sn, en);
    } else {
      markLocallyWatchedBulk(selected);
    }

    const catalogAired = catalog.filter((ep) => ep.isAired).length;
    const previousAired = Number(seriesProgress?.airedEpisodesCount ?? 0);
    const showTotal = Number(showDetails?.numberOfEpisodes ?? showDetails?.number_of_episodes ?? 0);
    
    // We want the true aired count. If catalog doesn't cover the whole series,
    // catalogAired will be too small. Use the max of known values.
    const airedCount = Math.max(catalogAired, previousAired, catalogAired > 0 ? catalogAired : showTotal);

    setPendingProgress({
      watchedCount: optimisticSet.size,
      airedCount,
      isSyncing: true,
    });

    if (!isWatched && !isWatchlisted && mediaItemForLists) {
      try {
        await libraryAdapter.saveLibraryItem(user.uid, {
          ...mediaItemForLists,
          ...libraryIdentity,
        }, "watching");
      } catch (err) {
        console.warn("Failed to upsert library item:", err);
      }
    }

    // Fire background network sync
    markEpisodeWatched({
      titleKey,
      seasonNumber: sn,
      episodeNumber: en,
      mode,
      episodeCatalog: catalog,
      expectedEpisodesCount: Number(showDetails?.numberOfEpisodes ?? showDetails?.number_of_episodes ?? 0),
      expectedSeasonsCount: Number(showDetails?.numberOfSeasons ?? showDetails?.number_of_seasons ?? 0),
    }).then(() => {
      invalidateContinueWatching(user.uid);
    }).catch((err) => {
      console.error("Background sync failed for markEpisodeWatched:", err);
      rollbackLocal(backupSet);
      setPendingProgress(backupProgress);
      if (onError) onError(err.message || "Connection timed out. Unable to save watch history.");
    });
    
    return selected;
  }, [
    user,
    watchedSet,
    pendingProgress,
    allSeasonsData,
    currentSeasonEpisodes,
    fetchAllSeasonDetails,
    markLocallyWatched,
    markLocallyWatchedBulk,
    seriesProgress?.airedEpisodesCount,
    isWatched,
    isWatchlisted,
    mediaItemForLists,
    markEpisodeWatched,
    titleKey,
    libraryIdentity,
    onError,
    rollbackLocal,
    showDetails,
  ]);

  const handleUnwatchSeries = useCallback(async () => {
    if (!user) throw new Error("User not authenticated.");
    clearAllLocal();
    setPendingProgress(null);
    await unwatchSeries({ titleKey });
    invalidateContinueWatching(user.uid);
  }, [user, titleKey, clearAllLocal, unwatchSeries]);

  return {
    watchedSet,
    watchedSetLoading,
    seriesProgress,
    pendingProgress,
    applyWatchMode,
    handleUnwatchSeries,
    markWatchedLoading,
    unwatchLoading,
  };
};
