import * as trackingRepository from "../repositories/TrackingRepository.js";
import * as catalogRepository from "../repositories/CatalogRepository.js";
import * as progressRepository from "../repositories/ProgressRepository.js";
import { ServiceError } from "./libraryService.js";

// Same exact logic from api/_lib/seriesProgress.js deriveLibraryStatus
function deriveLibraryStatus(existingStatus, watchedEpisodesCount, airedEpisodesCount) {
  if (watchedEpisodesCount <= 0) {
    return existingStatus === "plan_to_watch" || existingStatus === "dropped"
      ? existingStatus
      : "plan_to_watch";
  }
  if (airedEpisodesCount > 0 && watchedEpisodesCount >= airedEpisodesCount) {
    return "completed";
  }
  return "watching";
}

export async function updateWatchState(userId, payload) {
  if (!userId) throw new ServiceError(401, "Unauthenticated");
  
  const { titleKey, mode, seasonNumber, episodeNumber } = payload;
  
  if (!titleKey) throw new ServiceError(400, "TitleKey is required");
  if (!mode || !["single", "unwatch", "unwatch_all", "season", "season_unwatch"].includes(mode)) {
    throw new ServiceError(400, "Unsupported mode");
  }

  // 1. Fetch current catalog metadata
  const catalog = await catalogRepository.getMedia({ titleKey });
  if (!catalog) throw new ServiceError(404, "Title not found in catalog");
  
  const isAired = (sn, en) => {
     const ep = catalog.episodes.find(e => e.seasonNumber === sn && e.episodeNumber === en);
     return ep ? ep.isAired : false;
  };

  const airedEpisodesCount = catalog.episodes.filter(e => e.isAired).length;

  if (mode === "season") {
    if (!seasonNumber) throw new ServiceError(400, "SeasonNumber is required for season mode");
    const seasonEpisodes = catalog.episodes.filter(e => e.seasonNumber === Number(seasonNumber) && e.isAired);
    if (seasonEpisodes.length === 0) {
      throw new ServiceError(400, "No aired episodes found in season");
    }

    const progress = await progressRepository.getSeriesProgress({ userId, titleKey });
    const watchedEpisodes = await trackingRepository.getWatchedEpisodes({ userId, titleKey });
    const watchedSet = new Set(watchedEpisodes.map(ep => `${ep.seasonNumber}_${ep.episodeNumber}`));
    
    // Calculate new total watched episodes after marking this season watched
    let newlyWatchedCount = 0;
    for (const ep of seasonEpisodes) {
      if (!watchedSet.has(`${ep.seasonNumber}_${ep.episodeNumber}`)) {
        newlyWatchedCount++;
      }
    }

    const currentWatched = progress ? Number(progress.watched_episodes_count) : 0;
    const finalWatchedCount = currentWatched + newlyWatchedCount;
    const newStatus = deriveLibraryStatus(null, finalWatchedCount, airedEpisodesCount);

    await trackingRepository.markSeasonWatched({
      userId,
      titleKey,
      seasonNumber: Number(seasonNumber),
      episodes: seasonEpisodes,
      newStatus
    });

    return { success: true, status: newStatus };
  }
  else if (mode === "season_unwatch") {
    if (!seasonNumber) throw new ServiceError(400, "SeasonNumber is required for season_unwatch mode");
    const watchedEpisodes = await trackingRepository.getWatchedEpisodes({ userId, titleKey });
    const seasonWatchedCount = watchedEpisodes.filter(ep => ep.seasonNumber === Number(seasonNumber)).length;
    const currentWatchedCount = watchedEpisodes.length;
    const remainingCount = Math.max(0, currentWatchedCount - seasonWatchedCount);

    const fallbackStatus = deriveLibraryStatus(null, remainingCount, airedEpisodesCount);

    await trackingRepository.unwatchSeason({
      userId,
      titleKey,
      seasonNumber: Number(seasonNumber),
      fallbackStatus
    });

    return { success: true, status: remainingCount === 0 ? "plan_to_watch" : fallbackStatus };
  }
  else if (mode === "single") {
    if (!isAired(seasonNumber, episodeNumber)) {
       throw new ServiceError(400, "Cannot watch an unaired episode");
    }

    const progress = await progressRepository.getSeriesProgress({ userId, titleKey });
    const currentWatched = progress ? Number(progress.watched_episodes_count) : 0;
    
    const newStatus = deriveLibraryStatus(null, currentWatched + 1, airedEpisodesCount);

    await trackingRepository.markEpisodeWatched({
      userId,
      titleKey,
      seasonNumber,
      episodeNumber,
      newStatus
    });
    
    return { success: true, status: newStatus };
  } 
  else if (mode === "unwatch") {
    const progress = await progressRepository.getSeriesProgress({ userId, titleKey });
    const currentWatched = progress ? Number(progress.watched_episodes_count) : 0;
    const newWatchedCount = Math.max(0, currentWatched - 1);
    
    const fallbackStatus = deriveLibraryStatus(null, newWatchedCount, airedEpisodesCount);

    await trackingRepository.unwatchEpisode({
      userId,
      titleKey,
      seasonNumber,
      episodeNumber,
      fallbackStatus
    });

    return { success: true, status: newWatchedCount === 0 ? "plan_to_watch" : fallbackStatus };
  }
  else if (mode === "unwatch_all") {
    await trackingRepository.unwatchAllEpisodes({
      userId,
      titleKey
    });
    return { success: true, status: "plan_to_watch" };
  }
}
