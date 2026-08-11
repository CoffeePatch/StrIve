import prisma from "../prisma.js";
import { escapeCsvField } from "../csv.js";

/**
 * Normalizes Decimal types and Date objects to plain JSON-serializable values
 */
function normalizeDecimal(val) {
  if (val === null || val === undefined) return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

function normalizeDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString();
  if (typeof val === "string") return val;
  return null;
}

/**
 * Main export service for Strive user data
 * Performs parallel Prisma queries scoped strictly to userId
 * Zero Firestore, zero external TMDb/IMDb/Simkl API calls
 */
export async function exportUserData({ userId, format = "json" }) {
  // Parallel fetch scoped strictly to authenticated userId
  const [user, libraryItems, episodeStates, userLists] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, dashboardPreferences: true }
    }),
    prisma.userLibraryItem.findMany({
      where: { userId },
      include: {
        catalogTitle: {
          include: {
            seasons: true,
            episodes: true
          }
        }
      },
      orderBy: { addedAt: "desc" }
    }),
    prisma.userEpisodeState.findMany({
      where: { userId },
      include: {
        catalogTitle: true,
        catalogSeason: true,
        catalogEpisode: true
      },
      orderBy: { watchedAt: "desc" }
    }),
    prisma.userList.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            catalog: true
          },
          orderBy: { position: "asc" }
        }
      },
      orderBy: { createdAt: "asc" }
    })
  ]);

  if (format === "csv") {
    return generateCsvExport(libraryItems, userLists);
  }

  return generateJsonExport(user, userId, libraryItems, episodeStates, userLists);
}

/**
 * Generates canonical versioned JSON backup object
 */
function generateJsonExport(user, userId, libraryItems, episodeStates, userLists) {
  const catalogMap = new Map();
  const seasonMap = new Map();
  const episodeMap = new Map();

  // Deduplicate and index catalog titles, seasons, and episodes
  const addCatalogTitle = (title) => {
    if (!title || !title.titleKey || catalogMap.has(title.titleKey)) return;
    catalogMap.set(title.titleKey, {
      titleKey: title.titleKey,
      mediaType: title.mediaType,
      tmdbId: title.tmdbId,
      imdbId: title.imdbId,
      title: title.title,
      originalTitle: title.originalTitle,
      overview: title.overview,
      posterPath: title.posterPath,
      backdropPath: title.backdropPath,
      releaseDate: normalizeDate(title.releaseDate),
      firstAirDate: normalizeDate(title.firstAirDate),
      lastAirDate: normalizeDate(title.lastAirDate),
      showStatus: title.showStatus,
      runtimeMinutes: title.runtimeMinutes,
      numberOfSeasons: title.numberOfSeasons,
      numberOfEpisodes: title.numberOfEpisodes,
      tmdbScore: normalizeDecimal(title.tmdbScore),
      tmdbVotes: title.tmdbVotes,
      imdbScore: normalizeDecimal(title.imdbScore),
      imdbVotes: title.imdbVotes,
      popularity: normalizeDecimal(title.popularity),
      genres: title.genres || [],
      networks: title.networks || null
    });

    if (Array.isArray(title.seasons)) {
      title.seasons.forEach(s => addCatalogSeason(s));
    }
    if (Array.isArray(title.episodes)) {
      title.episodes.forEach(e => addCatalogEpisode(e));
    }
  };

  const addCatalogSeason = (season) => {
    if (!season || !season.titleKey || season.seasonNumber === undefined) return;
    const key = `${season.titleKey}_s${season.seasonNumber}`;
    if (seasonMap.has(key)) return;
    seasonMap.set(key, {
      titleKey: season.titleKey,
      seasonNumber: season.seasonNumber,
      title: season.title,
      overview: season.overview,
      posterPath: season.posterPath,
      airDate: normalizeDate(season.airDate),
      episodeCount: season.episodeCount
    });
  };

  const addCatalogEpisode = (ep) => {
    if (!ep || !ep.titleKey || ep.seasonNumber === undefined || ep.episodeNumber === undefined) return;
    const key = `${ep.titleKey}_s${ep.seasonNumber}_e${ep.episodeNumber}`;
    if (episodeMap.has(key)) return;
    episodeMap.set(key, {
      titleKey: ep.titleKey,
      seasonNumber: ep.seasonNumber,
      episodeNumber: ep.episodeNumber,
      absoluteOrder: ep.absoluteOrder,
      title: ep.title,
      overview: ep.overview,
      stillPath: ep.stillPath,
      airDate: normalizeDate(ep.airDate),
      runtimeMinutes: ep.runtimeMinutes,
      voteAverage: normalizeDecimal(ep.voteAverage),
      isAired: ep.isAired !== false
    });
  };

  // Collect catalog references from library items
  const formattedLibrary = libraryItems.map(item => {
    if (item.catalogTitle) addCatalogTitle(item.catalogTitle);
    return {
      titleKey: item.titleKey,
      status: item.status,
      userRating: normalizeDecimal(item.userRating),
      notes: item.notes || null,
      addedAt: normalizeDate(item.addedAt),
      lastWatchedAt: normalizeDate(item.lastWatchedAt)
    };
  });

  // Collect catalog references from episode states
  const formattedEpisodeStates = episodeStates.map(ep => {
    if (ep.catalogTitle) addCatalogTitle(ep.catalogTitle);
    if (ep.catalogSeason) addCatalogSeason(ep.catalogSeason);
    if (ep.catalogEpisode) addCatalogEpisode(ep.catalogEpisode);
    return {
      titleKey: ep.titleKey,
      seasonNumber: ep.seasonNumber,
      episodeNumber: ep.episodeNumber,
      absoluteOrder: ep.absoluteOrder,
      state: ep.state || "watched",
      watchedAt: normalizeDate(ep.watchedAt)
    };
  });

  // Collect catalog references from custom lists
  const formattedLists = userLists.map(list => {
    const items = (list.items || []).map(listItem => {
      if (listItem.catalog) addCatalogTitle(listItem.catalog);
      return {
        titleKey: listItem.titleKey,
        position: normalizeDecimal(listItem.position),
        addedAt: normalizeDate(listItem.addedAt)
      };
    });

    return {
      id: list.id,
      name: list.name,
      description: list.description || null,
      kind: list.kind || "custom",
      visibility: list.visibility || "private",
      isPinned: Boolean(list.isPinned),
      items
    };
  });

  return {
    format: "strive-backup",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    applicationVersion: "1.0.0",
    user: {
      id: userId,
      dashboardPreferences: user?.dashboardPreferences || {}
    },
    library: formattedLibrary,
    episodeStates: formattedEpisodeStates,
    lists: formattedLists,
    catalog: Array.from(catalogMap.values()),
    seasons: Array.from(seasonMap.values()),
    episodes: Array.from(episodeMap.values())
  };
}

/**
 * Generates practical CSV export string for library items
 */
function generateCsvExport(libraryItems, userLists) {
  // Build titleKey -> List Names map
  const itemListsMap = new Map();
  userLists.forEach(list => {
    (list.items || []).forEach(item => {
      if (!itemListsMap.has(item.titleKey)) {
        itemListsMap.set(item.titleKey, []);
      }
      itemListsMap.get(item.titleKey).push(list.name);
    });
  });

  const headers = [
    "Title",
    "Media Type",
    "TMDB ID",
    "IMDB ID",
    "Status",
    "User Rating",
    "Notes",
    "Added At",
    "Last Watched At",
    "Lists"
  ];

  const rows = libraryItems.map(item => {
    const catalog = item.catalogTitle || {};
    const lists = itemListsMap.get(item.titleKey) || [];
    return [
      escapeCsvField(catalog.title || item.titleKey),
      escapeCsvField(catalog.mediaType || "movie"),
      escapeCsvField(catalog.tmdbId ?? ""),
      escapeCsvField(catalog.imdbId ?? ""),
      escapeCsvField(item.status ?? ""),
      escapeCsvField(normalizeDecimal(item.userRating) ?? ""),
      escapeCsvField(item.notes ?? ""),
      escapeCsvField(normalizeDate(item.addedAt) ?? ""),
      escapeCsvField(normalizeDate(item.lastWatchedAt) ?? ""),
      escapeCsvField(lists.join("; "))
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\n");
}
