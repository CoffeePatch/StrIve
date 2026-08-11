import prisma from "../_lib/prisma.js";
import { verifyAuth } from "../_lib/authMiddleware.js";
import { handleApiError } from "../_lib/errorHandler.js";
import { sendError } from "../_lib/utils.js";
import { ensureCatalogTitle } from "../_lib/services/catalogService.js";

const MAX_CONFIRM_BATCH_SIZE = 500;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendError(res, 405, "method-not-allowed", "Only POST is allowed");
  }

  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;

    const { changes = [] } = req.body || {};

    if (!Array.isArray(changes) || changes.length === 0) {
      return sendError(res, 400, "invalid-payload", "No approved changes provided for confirmation");
    }

    if (changes.length > MAX_CONFIRM_BATCH_SIZE) {
      return sendError(res, 400, "batch-limit-exceeded", `Confirmation batch size exceeds limit of ${MAX_CONFIRM_BATCH_SIZE} items`);
    }

    // Server-side validation of change requests
    const validatedChanges = [];
    for (const change of changes) {
      if (!change || typeof change !== "object") continue;

      const mediaType = change.mediaType === "tv" ? "tv" : "movie";
      const tmdbId = change.tmdbId ? Number(change.tmdbId) : null;
      const imdbId = change.imdbId ? String(change.imdbId) : null;
      
      let titleKey = change.titleKey;
      if (!titleKey) {
        if (tmdbId) {
          titleKey = `tmdb_${mediaType}_${tmdbId}`;
        } else {
          continue; // Skip items without valid titleKey or tmdbId
        }
      }

      let importRating = change.importRating !== undefined && change.importRating !== null ? Number(change.importRating) : null;
      if (importRating !== null && (!Number.isFinite(importRating) || importRating < 1 || importRating > 10)) {
        importRating = importRating > 10 ? 10 : (importRating < 1 ? 1 : Math.round(importRating));
      }

      const validStatuses = ["completed", "watching", "plan_to_watch", "dropped", "on_hold"];
      const importStatus = change.importStatus && validStatuses.includes(change.importStatus) ? change.importStatus : "completed";
      const selectedFields = Array.isArray(change.selectedFields) ? change.selectedFields : ["status", "rating"];

      validatedChanges.push({
        titleKey,
        mediaType,
        tmdbId,
        imdbId,
        title: change.title || "Imported Item",
        importStatus,
        importRating,
        selectedFields,
        striveStatusAtPreview: change.striveStatus || null,
        striveRatingAtPreview: change.striveRating || null,
      });
    }

    if (validatedChanges.length === 0) {
      return sendError(res, 400, "no-valid-changes", "No valid change requests remain after server-side validation");
    }

    // Query current PostgreSQL state for stale preview detection
    const titleKeys = validatedChanges.map(c => c.titleKey);
    const existingItems = await prisma.userLibraryItem.findMany({
      where: {
        userId,
        titleKey: { in: titleKeys },
      },
    });

    const existingMap = new Map(existingItems.map(i => [i.titleKey, i]));

    let importedCount = 0;
    let staleCount = 0;
    let failedCount = 0;
    const itemResults = [];

    // Execute atomic PostgreSQL transaction
    await prisma.$transaction(async (tx) => {
      for (const change of validatedChanges) {
        try {
          const currentItem = existingMap.get(change.titleKey);

          // Stale preview check
          if (currentItem) {
            const currentRating = currentItem.userRating ? Math.round(Number(currentItem.userRating)) : null;
            const previewStatusChanged = change.striveStatusAtPreview && currentItem.status !== change.striveStatusAtPreview;
            const previewRatingChanged = change.striveRatingAtPreview !== null && currentRating !== change.striveRatingAtPreview;

            if (previewStatusChanged || previewRatingChanged) {
              staleCount++;
              itemResults.push({ titleKey: change.titleKey, status: "STALE", reason: "PostgreSQL record changed since preview analysis" });
              continue;
            }
          }

          // Ensure CatalogTitle exists cleanly
          if (change.tmdbId) {
            await ensureCatalogTitle(tx, change.titleKey, {
              title: change.title,
              mediaType: change.mediaType,
              tmdbId: change.tmdbId,
              imdbId: change.imdbId,
            });
          }

          const updateData = {};
          if (change.selectedFields.includes("status") && change.importStatus) {
            updateData.status = change.importStatus;
            updateData.lastWatchedAt = change.importStatus === "completed" ? new Date() : currentItem?.lastWatchedAt;
          }
          if (change.selectedFields.includes("rating") && change.importRating !== null) {
            updateData.userRating = change.importRating;
          }

          if (Object.keys(updateData).length === 0) {
            itemResults.push({ titleKey: change.titleKey, status: "SKIPPED", reason: "No fields selected for import" });
            continue;
          }

          // Upsert UserLibraryItem
          await tx.userLibraryItem.upsert({
            where: {
              userId_titleKey: {
                userId,
                titleKey: change.titleKey,
              },
            },
            create: {
              userId,
              titleKey: change.titleKey,
              status: updateData.status || "completed",
              userRating: updateData.userRating || null,
              lastWatchedAt: updateData.lastWatchedAt || new Date(),
              addedAt: new Date(),
            },
            update: updateData,
          });

          importedCount++;
          itemResults.push({ titleKey: change.titleKey, status: "IMPORTED" });
        } catch (err) {
          failedCount++;
          itemResults.push({ titleKey: change.titleKey, status: "FAILED", error: err.message });
        }
      }
    });

    return res.status(200).json({
      success: true,
      summary: {
        processed: validatedChanges.length,
        imported: importedCount,
        stale: staleCount,
        failed: failedCount,
      },
      results: itemResults,
    });
  } catch (err) {
    return handleApiError(res, err);
  }
}
