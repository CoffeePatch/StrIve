import { useState, useEffect, useRef, useCallback } from "react";
import useEpisodeStates from "../../hooks/tv/useEpisodeStates";
import useMarkEpisodeWatched from "../../hooks/tv/useMarkEpisodeWatched";
import useUnwatchSeries from "../../hooks/tv/useUnwatchSeries";
import useSeriesProgress from "../../hooks/tv/useSeriesProgress";
import useRecomputeSeriesProgress from "../../hooks/tv/useRecomputeSeriesProgress";
import { libraryAdapter } from "../library/libraryAdapter";
import { buildEpisodeCatalog, selectEpisodesForMode, createEpisodeKey } from "./trackingHelpers";
import { invalidateContinueWatching } from "../../util/cache/sessionCache";

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
  isWatchlisted
}) => {
  const titleKey = `tmdb_tv_${tvId}`;

  // Local State
  const [pendingProgress, setPendingProgress] = useState(null);
  const recomputeKeyRef = useRef(null);

  // Existing Tracking Hooks
  const { watchedSet, markLocallyWatched, markLocallyWatchedBulk, clearAllLocal } = useEpisodeStates({ userId: user?.uid, titleKey });
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
    if (!fullCatalogData || fullCatalogData.length === 0) {
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

    if (selected.length === 1) {
      markLocallyWatched(sn, en);
    } else {
      markLocallyWatchedBulk(selected);
    }

    const airedCount = catalog.filter((ep) => ep.isAired).length
      || Number(seriesProgress?.airedEpisodesCount ?? showDetails?.numberOfEpisodes ?? showDetails?.number_of_episodes ?? 0);

    setPendingProgress({
      watchedCount: optimisticSet.size,
      airedCount,
      isSyncing: true,
    });

    if (!isWatched && !isWatchlisted && mediaItemForLists) {
      try {
        await libraryAdapter.saveLibraryItem(user.uid, mediaItemForLists, "watching");
      } catch (err) {
        console.warn("Failed to upsert library item:", err);
      }
    }

    try {
      await markEpisodeWatched({
        titleKey,
        seasonNumber: sn,
        episodeNumber: en,
        mode,
        episodeCatalog: catalog,
      });
      invalidateContinueWatching(user.uid);
      return selected;
    } catch (err) {
      setPendingProgress(null);
      throw err;
    }
  }, [
    user,
    watchedSet,
    allSeasonsData,
    currentSeasonEpisodes,
    fetchAllSeasonDetails,
    markLocallyWatched,
    markLocallyWatchedBulk,
    seriesProgress?.airedEpisodesCount,
    showDetails?.numberOfEpisodes,
    showDetails?.number_of_episodes,
    isWatched,
    isWatchlisted,
    mediaItemForLists,
    markEpisodeWatched,
    titleKey,
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
    seriesProgress,
    pendingProgress,
    applyWatchMode,
    handleUnwatchSeries,
    markWatchedLoading,
    unwatchLoading,
  };
};
