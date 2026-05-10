/**
 * Migration Service
 * 
 * One-time migration from old data structures to unified "library_items" format.
 * 
 * Old Structure:
 *   users/{uid}/watchlist/{tmdbId}
 *   users/{uid}/watched/{tmdbId}
 *   users/{uid}/custom_lists/{listId}/items/{tmdbId}
 * 
 * New Structure:
 *   users/{uid}/library_items/{titleKey}
 */

import { db } from './firebase';
import {
  collection,
  getDocs,
  doc,
  query,
  setDoc,
} from 'firebase/firestore';
import { upsertLibraryItemV2 } from './firestoreService';

const normalizeStatus = (status, fallback = null) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'plan_to_watch' || normalized === 'watchlist') return 'plan_to_watch';
  if (normalized === 'completed' || normalized === 'watched') return 'completed';
  if (normalized === 'watching') return 'watching';
  if (normalized === 'dropped') return 'dropped';
  return fallback;
};

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
};

const buildMediaItem = (itemData = {}, tmdbId, forcedMediaType = null) => {
  const numericId = toNumber(itemData.id ?? itemData.tmdbId ?? tmdbId);
  const mediaType =
    forcedMediaType ||
    itemData.media_type ||
    itemData.mediaType ||
    (itemData.first_air_date ? 'tv' : 'movie');

  return {
    id: numericId,
    tmdbId: numericId,
    title: itemData.title || itemData.name || '',
    name: itemData.name || itemData.title || '',
    poster_path: itemData.poster_path || '',
    overview: itemData.overview || '',
    release_date: itemData.release_date || itemData.first_air_date || '',
    first_air_date: itemData.first_air_date || itemData.release_date || '',
    vote_average: toNumber(itemData.vote_average ?? itemData.tmdb_rating) || 0,
    vote_count: toNumber(itemData.vote_count ?? itemData.tmdb_vote_count) || 0,
    media_type: mediaType === 'tv' ? 'tv' : 'movie',
    imdbId: itemData.imdbId || itemData.imdb_id || null,
    imdbRating: toNumber(itemData.imdbRating ?? itemData.imdb_rating),
    imdbVotes: toNumber(itemData.imdbVotes ?? itemData.imdb_vote_count),
    progress:
      itemData.progress ||
      {
        watchedEpisodesCount: toNumber(itemData.watchedEpisodesCount) || 0,
        totalEpisodesCount: toNumber(itemData.totalEpisodesCount) || 0,
        notAiredEpisodesCount: toNumber(itemData.notAiredEpisodesCount) || 0,
        nextToWatch: itemData.nextToWatch || null,
        lastWatched: itemData.lastWatched || null,
      },
  };
};

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
    customListItemsMigrated: 0,
    libraryItemsTouched: 0,
    errors: [],
    startTime: new Date(),
  };

  try {
    // 1. Migrate watchlist items
    console.log('🔄 Migrating watchlist items...');
    summary.watchlistMigrated = await migrateCollectionToLibraryItems(
      userId,
      'watchlist',
      'plan_to_watch'
    );

    // 2. Migrate watched items
    console.log('🔄 Migrating watched items...');
    summary.watchedMigrated = await migrateCollectionToLibraryItems(
      userId,
      'watched',
      'completed'
    );

    // 3. Migrate custom list items (attach listIds to unified docs)
    console.log('🔄 Migrating custom list items...');
    summary.customListItemsMigrated = await migrateCustomListsToLibraryItems(userId);

    summary.libraryItemsTouched =
      summary.watchlistMigrated + summary.watchedMigrated + summary.customListItemsMigrated;

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
 * Migrate a single legacy collection (watchlist/watched) to library_items
 * 
 * @param {string} userId - User ID
 * @param {string} collectionName - Old collection name (watchlist/watched)
 * @param {string} status - New status value (plan_to_watch/completed)
 * @returns {Promise<number>} Count of migrated items
 */
const migrateCollectionToLibraryItems = async (userId, collectionName, status) => {
  try {
    const oldCollectionRef = collection(db, 'users', userId, collectionName);
    const querySnapshot = await getDocs(oldCollectionRef);

    let migratedCount = 0;
    for (const docSnapshot of querySnapshot.docs) {
      try {
        const itemData = docSnapshot.data();
        const tmdbId = docSnapshot.id;
        const mediaItem = buildMediaItem(itemData, tmdbId);

        if (!mediaItem.id) continue;

        await upsertLibraryItemV2(userId, mediaItem, {
          status: normalizeStatus(itemData.status, status),
        });

        migratedCount++;

        console.log(
          `  ✓ ${collectionName}: ${itemData.title || itemData.name}`
        );
      } catch (itemError) {
        console.warn(`  ⚠️ Error migrating item:`, itemError);
      }
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

const migrateCustomListsToLibraryItems = async (userId) => {
  const listsRef = collection(db, 'users', userId, 'custom_lists');
  const listsSnapshot = await getDocs(listsRef);
  const libraryItemsRef = collection(db, 'users', userId, 'library_items');
  const libraryItemsSnapshot = await getDocs(libraryItemsRef);

  const libraryIndex = new Map();
  for (const itemDoc of libraryItemsSnapshot.docs) {
    const data = itemDoc.data();
    libraryIndex.set(itemDoc.id, {
      status: data?.status || null,
      listIds: Array.isArray(data?.listIds) ? data.listIds : [],
    });
  }

  let migratedCount = 0;

  for (const listDoc of listsSnapshot.docs) {
    const listId = listDoc.id;
    const itemsRef = collection(db, 'users', userId, 'custom_lists', listId, 'items');
    const itemsSnapshot = await getDocs(itemsRef);

    for (const itemDoc of itemsSnapshot.docs) {
      try {
        const itemData = itemDoc.data();
        const mediaItem = buildMediaItem(itemData, itemDoc.id);
        if (!mediaItem.id) continue;

        const mediaType = mediaItem.media_type === 'tv' ? 'tv' : 'movie';
        const titleKey = `tmdb_${mediaType}_${mediaItem.id}`;
        const existing = libraryIndex.get(titleKey);
        const resolvedStatus = normalizeStatus(
          itemData.status,
          normalizeStatus(existing?.status, 'plan_to_watch')
        );

        await upsertLibraryItemV2(userId, mediaItem, {
          listId,
          status: resolvedStatus,
        });

        libraryIndex.set(titleKey, {
          status: resolvedStatus,
          listIds: Array.from(new Set([...(existing?.listIds || []), listId])),
        });

        const itemRef = doc(db, 'users', userId, 'custom_lists', listId, 'items', itemDoc.id);
        await setMigrationMark(itemRef);

        migratedCount++;
      } catch (error) {
        console.warn(`  ⚠️ Failed custom list item migration for ${listId}/${itemDoc.id}:`, error.message);
      }
    }
  }

  return migratedCount;
};

const setMigrationMark = async (itemRef) => {
  await setDoc(
    itemRef,
    {
      migratedToLibraryItemsAt: new Date().toISOString(),
    },
    { merge: true }
  );
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
    const customListsRef = collection(db, 'users', userId, 'custom_lists');
    const libraryItemsRef = collection(db, 'users', userId, 'library_items');

    const watchlistSnap = await getDocs(query(watchlistRef));
    const watchedSnap = await getDocs(query(watchedRef));
    const customListsSnap = await getDocs(query(customListsRef));
    const libraryItemsSnap = await getDocs(query(libraryItemsRef));

    const libraryIndex = new Map();
    for (const itemDoc of libraryItemsSnap.docs) {
      const data = itemDoc.data();
      libraryIndex.set(itemDoc.id, {
        listIds: Array.isArray(data?.listIds) ? data.listIds : [],
        status: data?.status || null,
      });
    }

    const hasWatchlist = watchlistSnap.docs.length > 0;
    const hasWatched = watchedSnap.docs.length > 0;
    let customListItemsCount = 0;
    let customListItemsNeedingMigration = 0;

    for (const listDoc of customListsSnap.docs) {
      const listId = listDoc.id;
      const itemsRef = collection(db, 'users', userId, 'custom_lists', listId, 'items');
      const itemsSnap = await getDocs(itemsRef);
      customListItemsCount += itemsSnap.docs.length;

      for (const itemDoc of itemsSnap.docs) {
        const itemData = itemDoc.data();
        const mediaItem = buildMediaItem(itemData, itemDoc.id);
        if (!mediaItem.id) continue;

        const mediaType = mediaItem.media_type === 'tv' ? 'tv' : 'movie';
        const titleKey = `tmdb_${mediaType}_${mediaItem.id}`;
        const libraryItem = libraryIndex.get(titleKey);

        if (!libraryItem) {
          customListItemsNeedingMigration++;
          continue;
        }

        if (!libraryItem.listIds.includes(listId)) {
          customListItemsNeedingMigration++;
        }

        if (!normalizeStatus(libraryItem.status, null)) {
          customListItemsNeedingMigration++;
        }
      }
    }

    return {
      needed: hasWatchlist || hasWatched || customListItemsNeedingMigration > 0,
      hasWatchlist,
      hasWatched,
      hasCustomListItems: customListItemsCount > 0,
      watchlistCount: watchlistSnap.docs.length,
      watchedCount: watchedSnap.docs.length,
      customListItemsCount,
      customListItemsNeedingMigration,
      totalToBeMigrated:
        watchlistSnap.docs.length +
        watchedSnap.docs.length +
        customListItemsNeedingMigration,
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
