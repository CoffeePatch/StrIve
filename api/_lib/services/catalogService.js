import prisma from "../prisma.js";
import * as catalogRepository from "../repositories/CatalogRepository.js";
import * as progressRepository from "../repositories/ProgressRepository.js";
import * as trackingRepository from "../repositories/TrackingRepository.js";
import { ServiceError } from "./libraryService.js";

export async function searchCatalog(userId, query, options = {}) {
  if (!query || query.trim().length === 0) {
    throw new ServiceError(400, "Search query is required");
  }

  const limit = Number(options.limit) || 20;
  return catalogRepository.searchCatalog({ query, userId, limit });
}

export async function getMediaDetails(userId, titleKey) {
  if (!titleKey) throw new ServiceError(400, "TitleKey is required");

  const catalog = await catalogRepository.getMedia({ titleKey });
  if (!catalog) throw new ServiceError(404, "Media not found");

  let progress = null;
  if (userId) {
    const userLibraryItem = await prisma.userLibraryItem.findUnique({
      where: { userId_titleKey: { userId, titleKey } }
    });
    
    if (userLibraryItem) {
      catalog.userRating = userLibraryItem.userRating ? Number(userLibraryItem.userRating) : null;
      catalog.userStatus = userLibraryItem.status || null;
      catalog.userNotes = userLibraryItem.notes || null;
    } else {
      catalog.userRating = null;
      catalog.userStatus = null;
      catalog.userNotes = null;
    }

    progress = await progressRepository.getSeriesProgress({ userId, titleKey });
    
    // Inject watched states into seasons.episodes
    if (catalog.mediaType === "tv" && catalog.seasons) {
      const watchedEpisodes = await trackingRepository.getWatchedEpisodes({ userId, titleKey });
      
      // O(N) memory map: Set<"season_episode">
      const watchedSet = new Set(
        watchedEpisodes.map(ep => `${ep.seasonNumber}_${ep.episodeNumber}`)
      );
      
      catalog.seasons = catalog.seasons.map(season => ({
        ...season,
        episodes: (season.episodes || []).map(ep => ({
          ...ep,
          watched: watchedSet.has(`${season.seasonNumber}_${ep.episodeNumber}`)
        }))
      }));
    }
  }

  // Preserves separation of catalog vs user-state as per Phase 2.9
  return { catalog, progress };
}
