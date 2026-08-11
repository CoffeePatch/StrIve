import prisma from "../prisma.js";
import * as catalogRepository from "../repositories/CatalogRepository.js";
import * as progressRepository from "../repositories/ProgressRepository.js";
import * as trackingRepository from "../repositories/TrackingRepository.js";
import { ServiceError } from "./libraryService.js";

/**
 * Ensures a CatalogTitle record exists in PostgreSQL before linking dependent user library or tracking items.
 * Reuses existing PostgreSQL catalog records cleanly without redundant external TMDb/IMDb API calls.
 */
export async function ensureCatalogTitle(titleKey, metadata = {}, options = {}) {
  if (!titleKey) return null;

  const db = options.tx || prisma;
  const forceRefresh = Boolean(options.forceRefresh);

  // 1. Check if CatalogTitle already exists in PostgreSQL
  const existing = await db.catalogTitle.findUnique({
    where: { titleKey },
  });

  if (existing && !forceRefresh) {
    return existing; // Reuse existing PostgreSQL catalog data immediately
  }

  // 2. Derive mediaType and tmdbId from titleKey (e.g. tmdb_movie_550, tmdb_tv_1399)
  const match = String(titleKey).match(/^tmdb_(movie|tv)_(\d+)$/);
  const mediaType = metadata?.mediaType || (match ? match[1] : "movie");
  const tmdbId = match ? Number(match[2]) : (metadata?.tmdbId ? Number(metadata.tmdbId) : null);

  const fallbackTitle = metadata?.title || metadata?.name || (match ? `${mediaType === "tv" ? "TV Series" : "Movie"} #${match[2]}` : titleKey);

  try {
    const apiKey = process.env.TMDB_API_KEY;
    if (apiKey && Number.isFinite(tmdbId)) {
      const tmdbRes = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${apiKey}&language=en-US`);
      if (tmdbRes.ok) {
        const tmdbData = await tmdbRes.json();
        const catalogData = {
          titleKey,
          mediaType,
          tmdbId,
          imdbId: tmdbData.imdb_id || metadata?.imdbId || existing?.imdbId || null,
          title: tmdbData.title || tmdbData.name || fallbackTitle,
          originalTitle: tmdbData.original_title || tmdbData.original_name || existing?.originalTitle || null,
          overview: tmdbData.overview || metadata?.overview || existing?.overview || null,
          posterPath: tmdbData.poster_path || metadata?.posterPath || existing?.posterPath || null,
          backdropPath: tmdbData.backdrop_path || metadata?.backdropPath || existing?.backdropPath || null,
          releaseDate: tmdbData.release_date ? new Date(tmdbData.release_date) : (existing?.releaseDate || null),
          firstAirDate: tmdbData.first_air_date ? new Date(tmdbData.first_air_date) : (existing?.firstAirDate || null),
          showStatus: tmdbData.status || existing?.showStatus || null,
          runtimeMinutes: tmdbData.runtime || (Array.isArray(tmdbData.episode_run_time) ? tmdbData.episode_run_time[0] : null) || existing?.runtimeMinutes || null,
          numberOfSeasons: tmdbData.number_of_seasons || existing?.numberOfSeasons || null,
          numberOfEpisodes: tmdbData.number_of_episodes || existing?.numberOfEpisodes || null,
          tmdbScore: tmdbData.vote_average ? Number(tmdbData.vote_average) : (existing?.tmdbScore ? Number(existing.tmdbScore) : null),
          tmdbVotes: tmdbData.vote_count ? Number(tmdbData.vote_count) : (existing?.tmdbVotes || null),
          genres: Array.isArray(tmdbData.genres) ? tmdbData.genres.map(g => g.name) : (existing?.genres || []),
        };

        return await db.catalogTitle.upsert({
          where: { titleKey },
          create: catalogData,
          update: catalogData,
        });
      }
    }
  } catch (err) {
    console.warn(`TMDb API enrichment fetch skipped for ${titleKey}:`, err?.message || err);
  }

  // Resilient minimal CatalogTitle if TMDb fetch is skipped/fails
  return await db.catalogTitle.upsert({
    where: { titleKey },
    create: {
      titleKey,
      mediaType,
      tmdbId: Number.isFinite(tmdbId) ? tmdbId : null,
      title: fallbackTitle,
      posterPath: metadata?.posterPath || null,
      overview: metadata?.overview || null,
    },
    update: {},
  });
}

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
    
    if (catalog.mediaType === "tv" && catalog.seasons) {
      const watchedEpisodes = await trackingRepository.getWatchedEpisodes({ userId, titleKey });
      
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

  return { catalog, progress };
}
