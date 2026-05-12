/**
 * Consolidation Migration Service (TypeScript)
 * 
 * Consolidates fragmented Firestore collections into unified `library_items`.
 * For use in Cloud Functions, scripts, or admin operations.
 * 
 * Usage:
 *   const result = await consolidateLibraryTyped(userId, { cleanup: true });
 */

import {
  doc,
  collection,
  getDocs,
  writeBatch,
  getDoc,
  setDoc,
  Timestamp,
  DocumentReference,
  QueryDocumentSnapshot,
  DocumentData,
  WriteBatch,
} from "firebase/firestore";
import { db } from "../util/firebase/firebase";

interface MigrationStats {
  migrated: number;
  skipped: number;
  errors: string[];
}

interface ConsolidationOptions {
  dryRun?: boolean;
  cleanup?: boolean;
  verbose?: boolean;
}

interface MigrationResult {
  status: "pending" | "in_progress" | "completed" | "failed";
  startedAt: Timestamp | null;
  completedAt: Timestamp | null;
  stats: {
    watchlistMigrated: number;
    watchedMigrated: number;
    listsRenamed: number;
    itemsSkipped: number;
    errors: string[];
  };
  error?: string;
}

const BATCH_SIZE = 500;
const CONSOLIDATION_STATE_DOC = "consolidationMigrationState";

/**
 * Generate titleKey from TMDB ID and media type
 */
function generateTitleKey(tmdbId: string | number, mediaType: string): string {
  const type = mediaType === "tv" ? "tv" : "movie";
  return `tmdb_${type}_${tmdbId}`;
}

/**
 * Extract TMDB ID from titleKey or data object
 */
function extractTmdbId(input: string | number | any): string {
  if (typeof input === "string") {
    const match = input.match(/tmdb_(?:movie|tv)_(\d+)/);
    if (match) return match[1];
  }
  return String(input?.id || input?.tmdbId || input);
}

/**
 * Infer media type from data
 */
function inferMediaType(data: DocumentData): string {
  return (
    data?.media_type ||
    data?.mediaType ||
    (data?.first_air_date ? "tv" : "movie") ||
    "movie"
  );
}

/**
 * Log helper (respects verbose flag)
 */
function log(
  message: string,
  verbose: boolean = false,
  level: "info" | "warn" | "error" = "info"
): void {
  if (!verbose && level === "info") return;

  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}]`;

  if (level === "error") {
    console.error(`${prefix} ${message}`);
  } else if (level === "warn") {
    console.warn(`${prefix} ${message}`);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

/**
 * Get or create migration state document
 */
async function getOrCreateMigrationState(
  userId: string
): Promise<MigrationResult> {
  const stateRef = doc(db, "users", userId, CONSOLIDATION_STATE_DOC);
  const stateSnap = await getDoc(stateRef);

  if (stateSnap.exists()) {
    return stateSnap.data() as MigrationResult;
  }

  return {
    status: "pending",
    startedAt: null,
    completedAt: null,
    stats: {
      watchlistMigrated: 0,
      watchedMigrated: 0,
      listsRenamed: 0,
      itemsSkipped: 0,
      errors: [],
    },
  };
}

/**
 * Update migration state document
 */
async function updateMigrationState(
  userId: string,
  updates: Partial<MigrationResult>
): Promise<void> {
  const stateRef = doc(db, "users", userId, CONSOLIDATION_STATE_DOC);
  await setDoc(stateRef, updates, { merge: true });
}

/**
 * Merge library item with tracking data
 */
function mergeLibraryItem(
  sourceData: DocumentData,
  titleKey: string,
  mediaType: string,
  tmdbId: string,
  existingData: DocumentData,
  watchStatus: string
): DocumentData {
  const existingTracking = existingData?.tracking || {};

  return {
    ...sourceData,
    titleKey,
    mediaType,
    id: String(tmdbId),
    tracking: {
      ...existingTracking,
      watchStatus,
      addedAt:
        existingTracking.addedAt ||
        sourceData.addedAt ||
        sourceData.addedToWatchlistAt ||
        Timestamp.now(),
      updatedAt: Timestamp.now(),
      listIds: Array.isArray(existingTracking.listIds)
        ? existingTracking.listIds
        : [],
    },
  };
}

/**
 * STEP 1: Migrate watchlist items
 */
async function migrateWatchlist(
  userId: string,
  options: ConsolidationOptions = {}
): Promise<MigrationStats> {
  const { dryRun = false, verbose = false } = options;
  log("📋 STEP 1: Migrating Watchlist...", true);

  const watchlistRef = collection(db, "users", userId, "watchlist");
  const watchlistSnap = await getDocs(watchlistRef);

  if (watchlistSnap.empty) {
    log("  ✓ Watchlist is empty, skipping.", true);
    return { migrated: 0, skipped: 0, errors: [] };
  }

  const stats: MigrationStats = { migrated: 0, skipped: 0, errors: [] };
  const batches: WriteBatch[] = [];
  let currentBatch = writeBatch(db);
  let batchOpCount = 0;

  for (const watchlistDoc of watchlistSnap.docs) {
    try {
      const watchlistData = watchlistDoc.data();
      const tmdbId = extractTmdbId(watchlistData);
      const mediaType = inferMediaType(watchlistData);

      if (!tmdbId || tmdbId === "undefined") {
        log(
          `  ⚠ Skipping watchlist item ${watchlistDoc.id}: no valid TMDB ID`,
          true,
          "warn"
        );
        stats.skipped++;
        continue;
      }

      const titleKey = generateTitleKey(tmdbId, mediaType);
      const libraryRef = doc(db, "users", userId, "library_items", titleKey);

      let existingData: DocumentData = {};
      try {
        const existingSnap = await getDoc(libraryRef);
        if (existingSnap.exists()) {
          existingData = existingSnap.data() || {};
        }
      } catch (e) {
        log(
          `  ⚠ Could not fetch existing library item ${titleKey}: ${
            (e as Error).message
          }`,
          true,
          "warn"
        );
      }

      const updatedItem = mergeLibraryItem(
        watchlistData,
        titleKey,
        mediaType,
        tmdbId,
        existingData,
        "Plan to Watch"
      );

      if (!dryRun) {
        currentBatch.set(libraryRef, updatedItem, { merge: true });
        batchOpCount++;

        if (batchOpCount === BATCH_SIZE) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          batchOpCount = 0;
        }
      }

      stats.migrated++;
      log(
        `  ✓ Watchlist: ${titleKey} → Plan to Watch`,
        verbose,
        "info"
      );
    } catch (error) {
      const errorMsg = `watchlist/${watchlistDoc.id}: ${
        (error as Error).message
      }`;
      stats.errors.push(errorMsg);
      log(`  ✗ ${errorMsg}`, true, "error");
    }
  }

  if (batchOpCount > 0 && !dryRun) {
    batches.push(currentBatch);
  }

  if (!dryRun) {
    for (let i = 0; i < batches.length; i++) {
      await batches[i].commit();
      log(`  ✓ Committed batch ${i + 1}/${batches.length}`, true);
    }
  }

  log(
    `  Summary: ${stats.migrated} migrated, ${stats.skipped} skipped`,
    true
  );
  return stats;
}

/**
 * STEP 2: Migrate watched items
 */
async function migrateWatched(
  userId: string,
  options: ConsolidationOptions = {}
): Promise<MigrationStats> {
  const { dryRun = false, verbose = false } = options;
  log("✅ STEP 2: Migrating Watched...", true);

  const watchedRef = collection(db, "users", userId, "watched");
  const watchedSnap = await getDocs(watchedRef);

  if (watchedSnap.empty) {
    log("  ✓ Watched is empty, skipping.", true);
    return { migrated: 0, skipped: 0, errors: [] };
  }

  const stats: MigrationStats = { migrated: 0, skipped: 0, errors: [] };
  const batches: WriteBatch[] = [];
  let currentBatch = writeBatch(db);
  let batchOpCount = 0;

  for (const watchedDoc of watchedSnap.docs) {
    try {
      const watchedData = watchedDoc.data();
      const tmdbId = extractTmdbId(watchedData);
      const mediaType = inferMediaType(watchedData);

      if (!tmdbId || tmdbId === "undefined") {
        log(
          `  ⚠ Skipping watched item ${watchedDoc.id}: no valid TMDB ID`,
          true,
          "warn"
        );
        stats.skipped++;
        continue;
      }

      const titleKey = generateTitleKey(tmdbId, mediaType);
      const libraryRef = doc(db, "users", userId, "library_items", titleKey);

      let existingData: DocumentData = {};
      try {
        const existingSnap = await getDoc(libraryRef);
        if (existingSnap.exists()) {
          existingData = existingSnap.data() || {};
        }
      } catch (e) {
        log(
          `  ⚠ Could not fetch existing library item ${titleKey}: ${
            (e as Error).message
          }`,
          true,
          "warn"
        );
      }

      const updatedItem = mergeLibraryItem(
        watchedData,
        titleKey,
        mediaType,
        tmdbId,
        existingData,
        "Completed"
      );

      if (!dryRun) {
        currentBatch.set(libraryRef, updatedItem, { merge: true });
        batchOpCount++;

        if (batchOpCount === BATCH_SIZE) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          batchOpCount = 0;
        }
      }

      stats.migrated++;
      log(`  ✓ Watched: ${titleKey} → Completed`, verbose, "info");
    } catch (error) {
      const errorMsg = `watched/${watchedDoc.id}: ${(error as Error).message}`;
      stats.errors.push(errorMsg);
      log(`  ✗ ${errorMsg}`, true, "error");
    }
  }

  if (batchOpCount > 0 && !dryRun) {
    batches.push(currentBatch);
  }

  if (!dryRun) {
    for (let i = 0; i < batches.length; i++) {
      await batches[i].commit();
      log(`  ✓ Committed batch ${i + 1}/${batches.length}`, true);
    }
  }

  log(
    `  Summary: ${stats.migrated} migrated, ${stats.skipped} skipped`,
    true
  );
  return stats;
}

/**
 * STEP 3: Rename custom_lists to lists
 */
async function renameCustomListsToLists(
  userId: string,
  options: ConsolidationOptions = {}
): Promise<MigrationStats> {
  const { dryRun = false, verbose = false } = options;
  log("📚 STEP 3: Renaming custom_lists → lists...", true);

  const customListsRef = collection(db, "users", userId, "custom_lists");
  const customListsSnap = await getDocs(customListsRef);

  if (customListsSnap.empty) {
    log("  ✓ custom_lists is empty, skipping.", true);
    return { migrated: 0, skipped: 0, errors: [] };
  }

  const stats: MigrationStats = { migrated: 0, skipped: 0, errors: [] };
  const batches: WriteBatch[] = [];
  let currentBatch = writeBatch(db);
  let batchOpCount = 0;

  for (const customListDoc of customListsSnap.docs) {
    try {
      const customListData = customListDoc.data();
      const listId = customListDoc.id;

      const newListRef = doc(db, "users", userId, "lists", listId);

      if (!dryRun) {
        currentBatch.set(newListRef, customListData, { merge: true });
        batchOpCount++;

        if (batchOpCount === BATCH_SIZE) {
          batches.push(currentBatch);
          currentBatch = writeBatch(db);
          batchOpCount = 0;
        }
      }

      stats.migrated++;
      log(
        `  ✓ Renamed: custom_lists/${listId} → lists/${listId}`,
        verbose,
        "info"
      );
    } catch (error) {
      const errorMsg = `custom_lists/${customListDoc.id}: ${
        (error as Error).message
      }`;
      stats.errors.push(errorMsg);
      log(`  ✗ ${errorMsg}`, true, "error");
    }
  }

  if (batchOpCount > 0 && !dryRun) {
    batches.push(currentBatch);
  }

  if (!dryRun) {
    for (let i = 0; i < batches.length; i++) {
      await batches[i].commit();
      log(`  ✓ Committed batch ${i + 1}/${batches.length}`, true);
    }
  }

  log(
    `  Summary: ${stats.migrated} lists renamed, ${stats.skipped} skipped`,
    true
  );
  return stats;
}

/**
 * STEP 4: Cleanup - Delete old collections
 */
async function cleanupOldCollections(
  userId: string,
  options: ConsolidationOptions = {}
): Promise<MigrationStats> {
  const { dryRun = false, verbose = false } = options;
  log("🗑️  STEP 4: Cleanup - Deleting old collections...", true);

  const collectionsToDelete = ["watchlist", "watched", "custom_lists"];
  const stats: MigrationStats = { deleted: 0, skipped: 0, errors: [] } as any;

  for (const collectionName of collectionsToDelete) {
    try {
      const collectionRef = collection(db, "users", userId, collectionName);
      const collectionSnap = await getDocs(collectionRef);

      if (collectionSnap.empty) {
        log(`  ✓ ${collectionName} is empty, skipping.`, true);
        stats.skipped++;
        continue;
      }

      const batches: WriteBatch[] = [];
      let currentBatch = writeBatch(db);
      let batchOpCount = 0;

      for (const docSnap of collectionSnap.docs) {
        if (!dryRun) {
          currentBatch.delete(docSnap.ref);
          batchOpCount++;

          if (batchOpCount === BATCH_SIZE) {
            batches.push(currentBatch);
            currentBatch = writeBatch(db);
            batchOpCount = 0;
          }
        }
      }

      if (batchOpCount > 0 && !dryRun) {
        batches.push(currentBatch);
      }

      if (!dryRun) {
        for (let i = 0; i < batches.length; i++) {
          await batches[i].commit();
        }
      }

      log(
        `  ✓ Deleted ${collectionSnap.size} documents from ${collectionName}`,
        true
      );
      (stats as any).deleted = ((stats as any).deleted || 0) + collectionSnap.size;
    } catch (error) {
      const errorMsg = `${collectionName}: ${(error as Error).message}`;
      stats.errors.push(errorMsg);
      log(`  ✗ ${errorMsg}`, true, "error");
    }
  }

  log(`  Summary: ${(stats as any).deleted} documents deleted`, true);
  return stats;
}

/**
 * Main migration orchestrator (TypeScript)
 */
export async function consolidateLibraryTyped(
  userId: string,
  options: ConsolidationOptions = {}
): Promise<MigrationResult> {
  const { dryRun = false, cleanup = false, verbose = false } = options;

  log(`\n${"=".repeat(60)}`, true);
  log("🚀 Starting Library Consolidation Migration", true);
  log(`${"=".repeat(60)}`, true);
  log(`User ID: ${userId}`, true);
  log(
    `Dry Run: ${dryRun ? "YES (no data modified)" : "NO (data will be modified)"}`,
    true
  );
  log(`Cleanup: ${cleanup ? "YES" : "NO"}`, true);

  try {
    let migrationState = await getOrCreateMigrationState(userId);

    if (migrationState.status === "completed") {
      log("\n⚠️  Migration already completed for this user.", true);
      log(`Completed at: ${migrationState.completedAt}`, true);
      return migrationState;
    }

    if (migrationState.status === "in_progress") {
      log("\n⚠️  Migration already in progress. Resuming...", true);
    }

    migrationState = {
      ...migrationState,
      status: "in_progress",
      startedAt: migrationState.startedAt || Timestamp.now(),
    };

    if (!dryRun) {
      await updateMigrationState(userId, migrationState);
    }

    const watchlistStats = await migrateWatchlist(userId, options);
    const watchedStats = await migrateWatched(userId, options);
    const listsStats = await renameCustomListsToLists(userId, options);

    let cleanupStats: MigrationStats = { deleted: 0, skipped: 0, errors: [] } as any;
    if (cleanup) {
      cleanupStats = await cleanupOldCollections(userId, options);
    } else {
      log(
        "\n⏭️  Skipping cleanup (use cleanup: true to delete old collections)",
        true
      );
    }

    migrationState = {
      status: dryRun ? "pending" : "completed",
      startedAt: migrationState.startedAt,
      completedAt: dryRun ? null : Timestamp.now(),
      stats: {
        watchlistMigrated: watchlistStats.migrated,
        watchedMigrated: watchedStats.migrated,
        listsRenamed: listsStats.migrated,
        itemsSkipped:
          watchlistStats.skipped +
          watchedStats.skipped +
          listsStats.skipped,
        errors: [
          ...watchlistStats.errors,
          ...watchedStats.errors,
          ...listsStats.errors,
          ...cleanupStats.errors,
        ],
      },
    };

    if (!dryRun) {
      await updateMigrationState(userId, migrationState);
    }

    log(`\n${"=".repeat(60)}`, true);
    log(
      `✨ Migration ${dryRun ? "preview" : "completed"}!`,
      true
    );
    log(`${"=".repeat(60)}`, true);
    log(`Watchlist items migrated: ${watchlistStats.migrated}`, true);
    log(`Watched items migrated: ${watchedStats.migrated}`, true);
    log(`Lists renamed: ${listsStats.migrated}`, true);
    if (cleanup) {
      log(`Documents deleted: ${(cleanupStats as any).deleted || 0}`, true);
    }
    log(`Items skipped: ${migrationState.stats.itemsSkipped}`, true);

    if (migrationState.stats.errors.length > 0) {
      log(
        `\n⚠️  Errors encountered: ${migrationState.stats.errors.length}`,
        true,
        "warn"
      );
      migrationState.stats.errors.forEach((err) =>
        log(`   - ${err}`, true, "error")
      );
    }

    return migrationState;
  } catch (error) {
    const errorMsg = `Migration failed: ${(error as Error).message}`;
    log(`\n❌ ${errorMsg}`, true, "error");

    const failedResult: MigrationResult = {
      status: "failed",
      startedAt: null,
      completedAt: null,
      stats: {
        watchlistMigrated: 0,
        watchedMigrated: 0,
        listsRenamed: 0,
        itemsSkipped: 0,
        errors: [errorMsg],
      },
      error: (error as Error).message,
    };

    if (!dryRun) {
      await updateMigrationState(userId, failedResult);
    }

    throw error;
  }
}
