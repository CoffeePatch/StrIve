import prisma from "../prisma.js";
import { validateBackupPayload, normalizeStatus, BackupValidationError } from "./importValidator.js";

/**
 * Migrates or normalizes legacy backup formats to Strive Backup v1 schema
 */
export function migrateBackupPayload(rawPayload) {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
    throw new BackupValidationError(400, "invalid-json-root", "Backup payload must be a JSON object");
  }

  // Legacy payload shape containing { data: { watchlist, watched } }
  if (rawPayload.data && (Array.isArray(rawPayload.data.watchlist) || Array.isArray(rawPayload.data.watched))) {
    const library = [];
    const catalogMap = new Map();

    const processLegacyItem = (item, defaultStatus) => {
      const mediaType = (item.mediaType || item.media_type || "movie").toLowerCase().includes("tv") ? "tv" : "movie";
      const tmdbId = Number(item.id || item.tmdbId);
      const titleKey = item.titleKey || (Number.isFinite(tmdbId) ? `tmdb_${mediaType}_${tmdbId}` : null);

      if (!titleKey) return;

      library.push({
        titleKey,
        status: defaultStatus,
        userRating: item.userRating ? Number(item.userRating) : null,
        notes: item.notes || null,
        addedAt: item.dateAdded || item.addedAt || null,
        lastWatchedAt: item.dateWatched || item.lastWatchedAt || null,
      });

      if (!catalogMap.has(titleKey)) {
        catalogMap.set(titleKey, {
          titleKey,
          mediaType,
          tmdbId: Number.isFinite(tmdbId) ? tmdbId : null,
          imdbId: item.imdbId || null,
          title: item.title || item.name || "Untitled",
          posterPath: item.posterPath || item.poster_path || null,
          releaseDate: item.year ? `${item.year}-01-01` : null,
          tmdbScore: item.tmdbRating ? Number(item.tmdbRating) : null,
          imdbScore: item.imdbRating ? Number(item.imdbRating) : null,
          imdbVotes: item.imdbVotes ? Number(item.imdbVotes) : null,
        });
      }
    };

    (rawPayload.data.watchlist || []).forEach(item => processLegacyItem(item, "plan_to_watch"));
    (rawPayload.data.watched || []).forEach(item => processLegacyItem(item, "completed"));

    return {
      format: "strive-backup",
      schemaVersion: 1,
      exportedAt: rawPayload.exportDate || new Date().toISOString(),
      user: { id: rawPayload.userId || null, dashboardPreferences: {} },
      library,
      episodeStates: [],
      lists: [],
      catalog: Array.from(catalogMap.values()),
      seasons: [],
      episodes: [],
    };
  }

  // Canonical Strive Backup JSON v1
  return {
    format: rawPayload.format || "strive-backup",
    schemaVersion: Number(rawPayload.schemaVersion) || 1,
    exportedAt: rawPayload.exportedAt || new Date().toISOString(),
    user: rawPayload.user || { id: null, dashboardPreferences: {} },
    library: Array.isArray(rawPayload.library) ? rawPayload.library : [],
    episodeStates: Array.isArray(rawPayload.episodeStates) ? rawPayload.episodeStates : [],
    lists: Array.isArray(rawPayload.lists) ? rawPayload.lists : [],
    catalog: Array.isArray(rawPayload.catalog) ? rawPayload.catalog : [],
    seasons: Array.isArray(rawPayload.seasons) ? rawPayload.seasons : [],
    episodes: Array.isArray(rawPayload.episodes) ? rawPayload.episodes : [],
  };
}

/**
 * Performs strict read-only preview diff analysis against PostgreSQL for an authenticated user
 * Zero database mutations, zero external API calls.
 */
export async function analyzeImportPayload({ userId, rawPayload }) {
  const jsonObj = typeof rawPayload === "string" ? JSON.parse(rawPayload) : rawPayload;

  // 1. Migrate & normalize payload
  const normalizedPayload = migrateBackupPayload(jsonObj);

  // 2. Validate payload structure & schema version
  const validation = validateBackupPayload(normalizedPayload);

  const { library, episodeStates, lists, catalog, seasons, episodes } = normalizedPayload;

  // 3. Extract unique titleKeys for efficient bounded set queries
  const titleKeysSet = new Set();
  library.forEach(i => i.titleKey && titleKeysSet.add(i.titleKey));
  episodeStates.forEach(e => e.titleKey && titleKeysSet.add(e.titleKey));
  lists.forEach(l => (l.items || []).forEach(i => i.titleKey && titleKeysSet.add(i.titleKey)));
  catalog.forEach(c => c.titleKey && titleKeysSet.add(c.titleKey));
  const titleKeysArray = Array.from(titleKeysSet);

  // 4. Parallel read-only fetch against target user's records in PostgreSQL
  const [existingLibraryItems, existingEpisodeStates, existingLists, existingCatalogTitles] = await Promise.all([
    prisma.userLibraryItem.findMany({
      where: { userId, titleKey: { in: titleKeysArray } },
      select: {
        titleKey: true,
        status: true,
        userRating: true,
        notes: true,
        addedAt: true,
        lastWatchedAt: true,
      },
    }),
    prisma.userEpisodeState.findMany({
      where: { userId, titleKey: { in: titleKeysArray } },
      select: {
        titleKey: true,
        seasonNumber: true,
        episodeNumber: true,
        absoluteOrder: true,
        state: true,
        watchedAt: true,
      },
    }),
    prisma.userList.findMany({
      where: { userId },
      include: {
        items: { select: { titleKey: true, position: true } },
      },
    }),
    prisma.catalogTitle.findMany({
      where: { titleKey: { in: titleKeysArray } },
      select: { titleKey: true, title: true, mediaType: true },
    }),
  ]);

  // Index existing records
  const existingLibraryMap = new Map(existingLibraryItems.map(item => [item.titleKey, item]));
  const existingEpisodeMap = new Map(existingEpisodeStates.map(ep => [`${ep.titleKey}_s${ep.seasonNumber}_e${ep.episodeNumber}`, ep]));
  const existingListIdMap = new Map(existingLists.map(l => [l.id, l]));
  const existingListNameMap = new Map(existingLists.map(l => [l.name.trim().toLowerCase(), l]));
  const existingCatalogSet = new Set(existingCatalogTitles.map(c => c.titleKey));
  const catalogTitleMap = new Map(catalog.map(c => [c.titleKey, c.title || c.titleKey]));
  existingCatalogTitles.forEach(c => catalogTitleMap.set(c.titleKey, c.title || c.titleKey));

  const conflicts = [];

  // --- 5. Library Conflict Analysis ---
  let libNew = 0;
  let libIdentical = 0;
  let libConflicts = 0;

  library.forEach(imported => {
    const existing = existingLibraryMap.get(imported.titleKey);
    if (!existing) {
      libNew++;
    } else {
      const impStatus = normalizeStatus(imported.status);
      const extStatus = normalizeStatus(existing.status);
      const impRating = imported.userRating !== null && imported.userRating !== undefined ? Number(imported.userRating) : null;
      const extRating = existing.userRating !== null && existing.userRating !== undefined ? Number(existing.userRating) : null;
      const impNotes = (imported.notes || "").trim();
      const extNotes = (existing.notes || "").trim();

      const statusDiffers = impStatus !== extStatus;
      const ratingDiffers = impRating !== extRating;
      const notesDiffer = Boolean(impNotes && impNotes !== extNotes);

      if (statusDiffers || ratingDiffers || notesDiffer) {
        libConflicts++;
        conflicts.push({
          type: "library_item",
          titleKey: imported.titleKey,
          displayTitle: catalogTitleMap.get(imported.titleKey) || imported.titleKey,
          differences: {
            ...(statusDiffers && { status: { existing: extStatus, imported: impStatus } }),
            ...(ratingDiffers && { userRating: { existing: extRating, imported: impRating } }),
            ...(notesDiffer && { notes: { existing: extNotes, imported: impNotes } }),
          },
        });
      } else {
        libIdentical++;
      }
    }
  });

  // --- 6. Episode State Analysis ---
  let epNew = 0;
  let epIdentical = 0;
  let epConflicts = 0;

  episodeStates.forEach(impEp => {
    const key = `${impEp.titleKey}_s${impEp.seasonNumber}_e${impEp.episodeNumber}`;
    const existingEp = existingEpisodeMap.get(key);
    if (!existingEp) {
      epNew++;
    } else {
      const stateDiffers = (impEp.state || "watched") !== (existingEp.state || "watched");
      if (stateDiffers) {
        epConflicts++;
        conflicts.push({
          type: "episode_state",
          titleKey: impEp.titleKey,
          displayTitle: `${catalogTitleMap.get(impEp.titleKey) || impEp.titleKey} (S${impEp.seasonNumber}E${impEp.episodeNumber})`,
          differences: {
            state: { existing: existingEp.state, imported: impEp.state },
          },
        });
      } else {
        epIdentical++;
      }
    }
  });

  // --- 7. List Analysis ---
  let listsNew = 0;
  let listsIdentical = 0;
  let listsConflicts = 0;

  lists.forEach(impList => {
    const existingById = impList.id ? existingListIdMap.get(impList.id) : null;
    const existingByName = impList.name ? existingListNameMap.get(impList.name.trim().toLowerCase()) : null;
    const existing = existingById || existingByName;

    if (!existing) {
      listsNew++;
    } else {
      const itemCountDiffers = (impList.items || []).length !== (existing.items || []).length;
      if (itemCountDiffers) {
        listsConflicts++;
        conflicts.push({
          type: "list",
          listId: existing.id,
          listName: impList.name,
          differences: {
            itemCount: { existing: (existing.items || []).length, imported: (impList.items || []).length },
          },
        });
      } else {
        listsIdentical++;
      }
    }
  });

  // --- 8. Catalog Analysis ---
  let catExisting = 0;
  let catNew = 0;

  catalog.forEach(c => {
    if (existingCatalogSet.has(c.titleKey)) {
      catExisting++;
    } else {
      catNew++;
    }
  });

  return {
    format: normalizedPayload.format,
    schemaVersion: normalizedPayload.schemaVersion,
    valid: true,
    summary: {
      library: {
        total: library.length,
        new: libNew,
        identical: libIdentical,
        conflicts: libConflicts,
      },
      episodes: {
        total: episodeStates.length,
        new: epNew,
        identical: epIdentical,
        conflicts: epConflicts,
      },
      lists: {
        total: lists.length,
        new: listsNew,
        identical: listsIdentical,
        conflicts: listsConflicts,
      },
      catalog: {
        totalTitles: catalog.length,
        existingTitles: catExisting,
        newTitles: catNew,
        seasons: seasons.length,
        episodes: episodes.length,
      },
    },
    conflicts,
    warnings: validation.warnings || [],
    errors: [],
  };
}
