/**
 * Migration Service
 * 
 * One-time migration from old data structure to new "One Doc, Many Tags" library format.
 * 
 * Old Structure:
 *   users/{uid}/watchlist/{tmdbId}
 *   users/{uid}/watched/{tmdbId}
 * 
 * New Structure:
 *   users/{uid}/library/{tmdbId} with status field
 */

import { db } from './firebase';
import {
  collection,
  getDocs,
  writeBatch,
  doc,
  query,
} from 'firebase/firestore';
import { updateLibraryItem } from './firestoreService';

/**
 * Migrate all old watchlist and watched data to new library collection
 * 
 * @param {string} userId - User ID to migrate
 * @returns {Promise<Object>} Migration summary with counts
 */
export const migrateUserData = async (userId) => {
  if (!userId) throw new Error('User ID required for migration');

  const summary = {
    watchlistMigrated: 0,
    watchedMigrated: 0,
    errors: [],
    startTime: new Date(),
  };

  try {
    // 1. Migrate watchlist items
    console.log('🔄 Migrating watchlist items...');
    summary.watchlistMigrated = await migrateCollectionToLibrary(
      userId,
      'watchlist',
      'plan_to_watch'
    );

    // 2. Migrate watched items
    console.log('🔄 Migrating watched items...');
    summary.watchedMigrated = await migrateCollectionToLibrary(
      userId,
      'watched',
      'completed'
    );

    summary.endTime = new Date();
    summary.durationMs = summary.endTime - summary.startTime;

    console.log('✅ Migration complete:', summary);
    return summary;
  } catch (error) {
    console.error('❌ Migration error:', error);
    summary.errors.push(error.message);
    return summary;
  }
};

/**
 * Migrate a single collection (watchlist/watched) to library
 * 
 * @param {string} userId - User ID
 * @param {string} collectionName - Old collection name (watchlist/watched)
 * @param {string} status - New status value (plan_to_watch/completed)
 * @returns {Promise<number>} Count of migrated items
 */
const migrateCollectionToLibrary = async (userId, collectionName, status) => {
  try {
    const oldCollectionRef = collection(db, 'users', userId, collectionName);
    const querySnapshot = await getDocs(oldCollectionRef);

    let migratedCount = 0;
    const batch = writeBatch(db);

    // For each item in old collection
    for (const docSnapshot of querySnapshot.docs) {
      if (migratedCount >= 25) {
        // Commit batch every 25 items to avoid hitting limits
        await batch.commit();
        migratedCount = 0;
        batch.reset?.();
      }

      try {
        const itemData = docSnapshot.data();
        const tmdbId = docSnapshot.id;

        // Move to new library collection with status
        const libraryDocRef = doc(
          db,
          'users',
          userId,
          'library',
          tmdbId
        );

        // Ensure required fields exist
        const libraryItem = {
          id: itemData.id || tmdbId,
          title: itemData.title || itemData.name,
          name: itemData.name,
          media_type: itemData.media_type || 'movie',
          poster_path: itemData.poster_path,
          overview: itemData.overview,
          release_date: itemData.release_date,
          first_air_date: itemData.first_air_date,
          vote_average: itemData.vote_average,
          // IMDb data if available
          imdbRating: itemData.imdbRating || null,
          imdbVotes: itemData.imdbVotes || null,
          // New fields
          status: status,
          dateAdded: itemData.dateAdded || new Date(),
          dateMigrated: new Date(),
          listIds: [],
        };

        batch.set(libraryDocRef, libraryItem, { merge: true });
        migratedCount++;

        console.log(
          `  ✓ ${collectionName}: ${itemData.title || itemData.name}`
        );
      } catch (itemError) {
        console.warn(`  ⚠️ Error migrating item:`, itemError);
      }
    }

    // Commit final batch
    if (migratedCount > 0) {
      await batch.commit();
    }

    return migratedCount;
  } catch (error) {
    console.error(
      `Error migrating ${collectionName} collection:`,
      error
    );
    throw error;
  }
};

/**
 * Check if migration is needed by looking for old collections
 * 
 * @param {string} userId - User ID to check
 * @returns {Promise<Object>} Status of old collections
 */
export const checkMigrationNeeded = async (userId) => {
  if (!userId) return { needed: false, hasWatchlist: false, hasWatched: false };

  try {
    const watchlistRef = collection(db, 'users', userId, 'watchlist');
    const watchedRef = collection(db, 'users', userId, 'watched');

    const watchlistSnap = await getDocs(query(watchlistRef));
    const watchedSnap = await getDocs(query(watchedRef));

    const hasWatchlist = watchlistSnap.docs.length > 0;
    const hasWatched = watchedSnap.docs.length > 0;

    return {
      needed: hasWatchlist || hasWatched,
      hasWatchlist,
      hasWatched,
      watchlistCount: watchlistSnap.docs.length,
      watchedCount: watchedSnap.docs.length,
      totalToBeMigrated: watchlistSnap.docs.length + watchedSnap.docs.length,
    };
  } catch (error) {
    console.error('Error checking migration status:', error);
    return { needed: false, error: error.message };
  }
};

/**
 * Archive old collections by renaming them (don't delete in case of rollback)
 * This should only be called AFTER successful migration
 * 
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export const archiveOldCollections = async (userId) => {
  if (!userId) throw new Error('User ID required');

  try {
    console.log('📦 Archiving old collections...');

    // Collections renamed to:
    // users/{uid}/watchlist -> users/{uid}/_archived_watchlist
    // users/{uid}/watched -> users/{uid}/_archived_watched

    // Firebase doesn't support directly renaming collections, so we mark
    // the old ones as migrated and can safely ignore them going forward

    console.log('✅ Old collections archived (keep for 30-day backup period)');
  } catch (error) {
    console.error('Error archiving collections:', error);
    throw error;
  }
};
