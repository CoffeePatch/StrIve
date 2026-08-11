import prisma from "../prisma.js";
import { normalizeStatus } from "./importValidator.js";

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function parseDecimal(val) {
  if (val === null || val === undefined || val === "") return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

/**
 * Executes a single atomic Prisma transaction for an import batch.
 * Scope is strictly locked to authenticated userId.
 * Supports idempotency, retry safety, clean account restoration, and MERGE/OVERWRITE/SKIP conflict modes.
 */
export async function confirmImportBatch({ userId, batchPayload, conflictStrategy = "MERGE" }) {
  const strategy = (conflictStrategy || "MERGE").toUpperCase();
  const validStrategies = new Set(["MERGE", "OVERWRITE", "SKIP"]);
  const mode = validStrategies.has(strategy) ? strategy : "MERGE";

  const libraryItems = Array.isArray(batchPayload.library) ? batchPayload.library : [];
  const episodeStates = Array.isArray(batchPayload.episodeStates) ? batchPayload.episodeStates : [];
  const customLists = Array.isArray(batchPayload.lists) ? batchPayload.lists : [];
  const catalogTitles = Array.isArray(batchPayload.catalog) ? batchPayload.catalog : [];
  const catalogSeasons = Array.isArray(batchPayload.seasons) ? batchPayload.seasons : [];
  const catalogEpisodes = Array.isArray(batchPayload.episodes) ? batchPayload.episodes : [];

  let processedCount = 0;
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  // Execute entire batch inside an atomic Prisma transaction
  await prisma.$transaction(async (tx) => {
    // 1. User Record Guarantee
    await tx.user.upsert({
      where: { id: userId },
      create: {
        id: userId,
        dashboardPreferences: batchPayload.user?.dashboardPreferences || {},
      },
      update: mode === "OVERWRITE" && batchPayload.user?.dashboardPreferences
        ? { dashboardPreferences: batchPayload.user.dashboardPreferences }
        : {},
    });

    // 2. Catalog Title Dependency Writes
    for (const cat of catalogTitles) {
      if (!cat || !cat.titleKey) continue;
      const releaseDate = parseDate(cat.releaseDate);
      const firstAirDate = parseDate(cat.firstAirDate);
      const lastAirDate = parseDate(cat.lastAirDate);

      await tx.catalogTitle.upsert({
        where: { titleKey: cat.titleKey },
        create: {
          titleKey: cat.titleKey,
          mediaType: cat.mediaType || "movie",
          tmdbId: cat.tmdbId || null,
          imdbId: cat.imdbId || null,
          title: cat.title || cat.titleKey,
          originalTitle: cat.originalTitle || null,
          overview: cat.overview || null,
          posterPath: cat.posterPath || null,
          backdropPath: cat.backdropPath || null,
          releaseDate,
          firstAirDate,
          lastAirDate,
          showStatus: cat.showStatus || null,
          runtimeMinutes: cat.runtimeMinutes || null,
          numberOfSeasons: cat.numberOfSeasons || null,
          numberOfEpisodes: cat.numberOfEpisodes || null,
          tmdbScore: parseDecimal(cat.tmdbScore),
          tmdbVotes: cat.tmdbVotes || null,
          imdbScore: parseDecimal(cat.imdbScore),
          imdbVotes: cat.imdbVotes || null,
          popularity: parseDecimal(cat.popularity),
          genres: Array.isArray(cat.genres) ? cat.genres : [],
          networks: cat.networks || null,
        },
        update: mode === "OVERWRITE" ? {
          title: cat.title || undefined,
          overview: cat.overview || undefined,
          posterPath: cat.posterPath || undefined,
          backdropPath: cat.backdropPath || undefined,
          imdbId: cat.imdbId || undefined,
          tmdbScore: parseDecimal(cat.tmdbScore) || undefined,
          imdbScore: parseDecimal(cat.imdbScore) || undefined,
        } : {},
      });
    }

    // 3. Catalog Season Dependency Writes
    for (const season of catalogSeasons) {
      if (!season || !season.titleKey || season.seasonNumber === undefined) continue;
      await tx.catalogSeason.upsert({
        where: {
          titleKey_seasonNumber: {
            titleKey: season.titleKey,
            seasonNumber: season.seasonNumber,
          },
        },
        create: {
          titleKey: season.titleKey,
          seasonNumber: season.seasonNumber,
          title: season.title || null,
          overview: season.overview || null,
          posterPath: season.posterPath || null,
          airDate: parseDate(season.airDate),
          episodeCount: season.episodeCount || null,
        },
        update: {},
      });
    }

    // 4. Catalog Episode Dependency Writes
    for (const ep of catalogEpisodes) {
      if (!ep || !ep.titleKey || ep.seasonNumber === undefined || ep.episodeNumber === undefined) continue;
      await tx.catalogEpisode.upsert({
        where: {
          titleKey_seasonNumber_episodeNumber: {
            titleKey: ep.titleKey,
            seasonNumber: ep.seasonNumber,
            episodeNumber: ep.episodeNumber,
          },
        },
        create: {
          titleKey: ep.titleKey,
          seasonNumber: ep.seasonNumber,
          episodeNumber: ep.episodeNumber,
          absoluteOrder: ep.absoluteOrder || null,
          title: ep.title || null,
          overview: ep.overview || null,
          stillPath: ep.stillPath || null,
          airDate: parseDate(ep.airDate),
          runtimeMinutes: ep.runtimeMinutes || null,
          voteAverage: parseDecimal(ep.voteAverage),
          isAired: ep.isAired !== false,
        },
        update: {},
      });
    }

    // 5. User Library Item Writes
    for (const item of libraryItems) {
      if (!item || !item.titleKey) continue;
      processedCount++;

      const existing = await tx.userLibraryItem.findUnique({
        where: { userId_titleKey: { userId, titleKey: item.titleKey } },
      });

      const impStatus = normalizeStatus(item.status);
      const impRating = parseDecimal(item.userRating);
      const impNotes = item.notes ? String(item.notes).trim() : null;
      const addedAt = parseDate(item.addedAt) || new Date();
      const lastWatchedAt = parseDate(item.lastWatchedAt);

      if (!existing) {
        await tx.userLibraryItem.create({
          data: {
            userId,
            titleKey: item.titleKey,
            status: impStatus,
            userRating: impRating,
            notes: impNotes,
            addedAt,
            lastWatchedAt,
            enrichmentStatus: "completed",
          },
        });
        createdCount++;
      } else {
        if (mode === "SKIP") {
          skippedCount++;
          continue;
        }

        if (mode === "OVERWRITE") {
          await tx.userLibraryItem.update({
            where: { userId_titleKey: { userId, titleKey: item.titleKey } },
            data: {
              status: impStatus,
              userRating: impRating,
              notes: impNotes,
              addedAt,
              lastWatchedAt: lastWatchedAt || existing.lastWatchedAt,
            },
          });
          updatedCount++;
        } else {
          // MERGE Strategy
          let targetStatus = existing.status;
          if (existing.status === "plan_to_watch" && (impStatus === "completed" || impStatus === "watching")) {
            targetStatus = impStatus;
          }

          const targetRating = existing.userRating !== null ? existing.userRating : impRating;

          let targetNotes = existing.notes;
          if (impNotes && impNotes !== (existing.notes || "").trim()) {
            targetNotes = existing.notes ? `${existing.notes}\n\n${impNotes}` : impNotes;
          }

          let targetWatchedAt = existing.lastWatchedAt;
          if (lastWatchedAt && (!existing.lastWatchedAt || lastWatchedAt > existing.lastWatchedAt)) {
            targetWatchedAt = lastWatchedAt;
          }

          await tx.userLibraryItem.update({
            where: { userId_titleKey: { userId, titleKey: item.titleKey } },
            data: {
              status: targetStatus,
              userRating: targetRating,
              notes: targetNotes,
              lastWatchedAt: targetWatchedAt,
            },
          });
          updatedCount++;
        }
      }
    }

    // 6. User Episode State Writes
    for (const ep of episodeStates) {
      if (!ep || !ep.titleKey || ep.seasonNumber === undefined || ep.episodeNumber === undefined) continue;

      const existingEp = await tx.userEpisodeState.findUnique({
        where: {
          userId_titleKey_seasonNumber_episodeNumber: {
            userId,
            titleKey: ep.titleKey,
            seasonNumber: ep.seasonNumber,
            episodeNumber: ep.episodeNumber,
          },
        },
      });

      const watchedAt = parseDate(ep.watchedAt) || new Date();
      const state = ep.state || "watched";

      if (!existingEp) {
        await tx.userEpisodeState.create({
          data: {
            userId,
            titleKey: ep.titleKey,
            seasonNumber: ep.seasonNumber,
            episodeNumber: ep.episodeNumber,
            absoluteOrder: ep.absoluteOrder || null,
            state,
            watchedAt,
          },
        });
      } else {
        if (mode === "OVERWRITE") {
          await tx.userEpisodeState.update({
            where: {
              userId_titleKey_seasonNumber_episodeNumber: {
                userId,
                titleKey: ep.titleKey,
                seasonNumber: ep.seasonNumber,
                episodeNumber: ep.episodeNumber,
              },
            },
            data: { state, watchedAt },
          });
        } else if (mode === "MERGE") {
          if (watchedAt && (!existingEp.watchedAt || watchedAt > existingEp.watchedAt)) {
            await tx.userEpisodeState.update({
              where: {
                userId_titleKey_seasonNumber_episodeNumber: {
                  userId,
                  titleKey: ep.titleKey,
                  seasonNumber: ep.seasonNumber,
                  episodeNumber: ep.episodeNumber,
                },
              },
              data: { watchedAt },
            });
          }
        }
      }
    }

    // 7. User List Writes
    for (const list of customLists) {
      if (!list || !list.name || !String(list.name).trim()) continue;

      // Find existing list by target user ownership + (ID or normalized name)
      let targetList = null;
      if (list.id) {
        targetList = await tx.userList.findFirst({
          where: { id: list.id, userId },
        });
      }

      if (!targetList) {
        targetList = await tx.userList.findFirst({
          where: { userId, name: list.name.trim() },
        });
      }

      if (!targetList) {
        targetList = await tx.userList.create({
          data: {
            userId,
            name: list.name.trim(),
            description: list.description || null,
            kind: list.kind || "custom",
            visibility: list.visibility || "private",
            isPinned: Boolean(list.isPinned),
            itemCount: 0,
          },
        });
      } else {
        if (mode === "OVERWRITE") {
          await tx.userListItem.deleteMany({
            where: { listId: targetList.id, userId },
          });
          await tx.userList.update({
            where: { id: targetList.id },
            data: {
              description: list.description || targetList.description,
              isPinned: list.isPinned !== undefined ? Boolean(list.isPinned) : targetList.isPinned,
            },
          });
        }
      }

      // Write list items
      const items = Array.isArray(list.items) ? list.items : [];
      for (let i = 0; i < items.length; i++) {
        const listItem = items[i];
        if (!listItem || !listItem.titleKey) continue;
        const position = parseDecimal(listItem.position) || (i + 1) * 1000.0;
        const itemAddedAt = parseDate(listItem.addedAt) || new Date();

        await tx.userListItem.upsert({
          where: {
            listId_titleKey: {
              listId: targetList.id,
              titleKey: listItem.titleKey,
            },
          },
          create: {
            listId: targetList.id,
            titleKey: listItem.titleKey,
            userId,
            position,
            addedAt: itemAddedAt,
          },
          update: mode === "OVERWRITE" ? { position } : {},
        });
      }

      // Recalculate list itemCount
      const finalCount = await tx.userListItem.count({
        where: { listId: targetList.id, userId },
      });
      await tx.userList.update({
        where: { id: targetList.id },
        data: { itemCount: finalCount },
      });
    }
  });

  return {
    success: true,
    batchIndex: batchPayload.batchIndex ?? 0,
    totalBatches: batchPayload.totalBatches ?? 1,
    processed: processedCount,
    created: createdCount,
    updated: updatedCount,
    skipped: skippedCount,
    errors: [],
  };
}
