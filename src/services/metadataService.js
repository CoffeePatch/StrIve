import {
  collection,
  setDoc,
  getDocs,
  deleteField
} from 'firebase/firestore';
import { db } from '../util/firebase/firebase';
import { firstNumber, fetchImdbData } from '../util/firebase/firestoreService';
import tmdbApiService from './tmdb/tmdbApiService';

// PHASE 2: ENRICHMENT BRIDGE - Refresh Metadata Utilities
// ============================================================================

const hasPositiveNumber = (value) => typeof value === "number" && Number.isFinite(value) && value > 0;

const deriveTmdbContext = (item = {}, docId = "") => {
  let mediaType = item.media_type || item.mediaType || null;
  let tmdbId = firstNumber(item.id, item.tmdbId);

  const keyMatch = String(item.titleKey || docId).match(/^tmdb_(movie|tv)_(\d+)$/);
  if (keyMatch) {
    mediaType = mediaType || keyMatch[1];
    tmdbId = tmdbId || Number(keyMatch[2]);
  }

  if (!tmdbId && /^\d+$/.test(String(docId))) {
    tmdbId = Number(docId);
  }

  if (!tmdbId || !Number.isFinite(tmdbId)) {
    return { tmdbId: null, mediaType: mediaType === "tv" ? "tv" : "movie" };
  }

  return {
    tmdbId: String(Math.trunc(tmdbId)),
    mediaType: mediaType === "tv" ? "tv" : "movie",
  };
};

const needsMetadataRefresh = (item = {}, forceRefresh = false) => {
  if (forceRefresh) return true;

  const imdbRating = firstNumber(item.imdbRating, item.imdb_rating);
  const imdbVotes = firstNumber(item.imdbVotes, item.imdb_vote_count);
  const voteCount = firstNumber(item.vote_count, item.tmdb_vote_count, item?.sort?.tmdbVotes);

  return !hasPositiveNumber(imdbRating) || !hasPositiveNumber(imdbVotes) || !hasPositiveNumber(voteCount) || !(item.imdbId || item.imdb_id);
};

const fetchTmdbMetadata = async (tmdbId, mediaType) => {
  try {
    if (!tmdbId) return null;

    const data = await tmdbApiService.get(`/${mediaType}/${tmdbId}`, { language: 'en-US' });

    if (!data) {
      return null;
    }

    return {
      vote_average: firstNumber(data.vote_average),
      vote_count: firstNumber(data.vote_count),
    };
  } catch (error) {
    console.warn(`Failed to fetch TMDB metadata for ${mediaType}:${tmdbId}: ${error.message}`);
    return null;
  }
};

const buildMetadataPatch = (item = {}, imdbData = {}, tmdbData = null) => {
  const imdbRating = firstNumber(imdbData.imdbRating, item.imdbRating, item.imdb_rating);
  const imdbVotes = firstNumber(imdbData.imdbVotes, item.imdbVotes, item.imdb_vote_count);
  const imdbId = imdbData.imdbId || item.imdbId || item.imdb_id || null;

  const voteAverage = firstNumber(tmdbData?.vote_average, item.vote_average, item.tmdb_rating, item?.sort?.tmdbRating) || 0;
  const voteCount = firstNumber(tmdbData?.vote_count, item.vote_count, item.tmdb_vote_count, item?.sort?.tmdbVotes) || 0;

  return {
    imdbId,
    imdbRating: deleteField(),
    imdbVotes: deleteField(),
    imdb_rating: deleteField(),
    imdb_vote_count: deleteField(),
    vote_average: deleteField(),
    vote_count: deleteField(),
    tmdb_rating: deleteField(),
    tmdb_vote_count: deleteField(),
    sort: {
      imdbRating: deleteField(),
      imdbVotes: deleteField(),
      tmdbRating: deleteField(),
      tmdbVotes: deleteField(),
    },
    ratings: {
      imdbScore: imdbRating ?? null,
      imdbVotes: imdbVotes ?? null,
      tmdbScore: voteAverage,
      tmdbVotes: voteCount,
    },
    lastMetadataRefresh: new Date().toISOString(),
  };
};

const collectMetadataTargets = async (userId) => {
  const targets = [];

  const libraryItemsRef = collection(db, "users", userId, "library_items");
  const libraryItemsSnap = await getDocs(libraryItemsRef);
  libraryItemsSnap.docs.forEach((snap) => {
    targets.push({
      docRef: snap.ref,
      docId: snap.id,
      source: "library_items",
      ...snap.data(),
    });
  });

  return targets;
};

export const processMetadataItem = async (item, summary = null) => {
  const { tmdbId, mediaType } = deriveTmdbContext(item, item.docId);
  if (!tmdbId) {
    throw new Error("Missing TMDB id");
  }

  const imdbData = await fetchImdbData(tmdbId, mediaType);
  const tmdbData = await fetchTmdbMetadata(tmdbId, mediaType);
  const patch = buildMetadataPatch(item, imdbData, tmdbData);

  if (patch.imdbRating !== null || patch.imdbId || patch.vote_count > 0) {
    await setDoc(item.docRef, patch, { merge: true });

    if (summary) {
      summary.refreshed++;
      if (summary.bySource && summary.bySource[item.source] !== undefined) {
        summary.bySource[item.source] += 1;
      }
    }
    console.log(`Refreshed: ${item.title || item.name || item.docId} (${item.source})`);
  } else {
    console.warn(`No metadata found for: ${item.title || item.name || item.docId}`);
  }
};

/**
 * Refreshes IMDb metadata for items with missing or null ratings
 * Safe to call repeatedly - only updates items that need it
 * 
 * @param {string} userId - The UID of the user
 * @param {object} options - Configuration options
 * @param {number} options.batchSize - Number of items to process (default: 50)
 * @param {boolean} options.forceRefresh - If true, refetch ALL items (default: false)
 * @param {function} options.onProgress - Callback for progress updates
 * @returns {Promise<object>} Summary of refresh operation
 */
export const refreshLibraryMetadata = async (
  userId,
  options = {}
) => {
  const {
    batchSize = 50,
    forceRefresh = false,
    onProgress = null,
  } = options;

  try {
    const allTargets = await collectMetadataTargets(userId);
    const itemsToRefresh = allTargets
      .filter((item) => needsMetadataRefresh(item, forceRefresh))
      .slice(0, batchSize);

    const summary = {
      totalItems: allTargets.length,
      itemsToRefresh: itemsToRefresh.length,
      refreshed: 0,
      failed: 0,
      errors: [],
      startTime: new Date(),
      bySource: {
        library_items: 0,
        library: 0,
        custom_list_items: 0,
      },
    };

    console.log(`Starting metadata refresh for ${itemsToRefresh.length} items (batch size: ${batchSize})`);

    // Process each item with concurrency control
    for (let i = 0; i < itemsToRefresh.length; i++) {
      const item = itemsToRefresh[i];

      try {
        // Report progress
        if (onProgress) {
          onProgress({
            current: i + 1,
            total: itemsToRefresh.length,
            itemTitle: item.title,
          });
        }

        await processMetadataItem(item, summary);
      } catch (error) {
        summary.failed++;
        summary.errors.push({
          itemId: item.id || item.docId,
          title: item.title || item.name || item.docId,
          source: item.source,
          error: error.message,
        });
        console.error(`Failed to refresh ${item.title || item.name || item.docId}:`, error.message);
      }

      // Small delay to prevent overwhelming the API
      if (i < itemsToRefresh.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    summary.endTime = new Date();
    summary.duration = summary.endTime - summary.startTime;
    console.log(`Γ£à Metadata refresh complete:`, summary);
    return summary;
  } catch (error) {
    console.error("Error refreshing library metadata:", error);
    throw error;
  }
};



/**
 * Gets items with missing IMDb metadata
 * Useful for diagnostic and UI purposes
 * 
 * @param {string} userId - The UID of the user
 * @returns {Promise<Array>} Array of items with missing metadata
 */
export const getItemsWithMissingMetadata = async (userId) => {
  try {
    const allTargets = await collectMetadataTargets(userId);

    const missingMetadata = allTargets
      .filter((item) => needsMetadataRefresh(item, false))
      .map((item) => ({
        id: item.id || item.docId,
        title: item.title || item.name || item.docId,
        mediaType: deriveTmdbContext(item, item.docId).mediaType,
        source: item.source,
        listId: item.listId || null,
      }));

    console.log(`Found ${missingMetadata.length} items with missing metadata`);
    return missingMetadata;
  } catch (error) {
    console.error("Error getting items with missing metadata:", error);
    throw error;
  }
};

/**
 * Gets statistics about library metadata completeness
 * Useful for dashboards and monitoring
 * 
 * @param {string} userId - The UID of the user
 * @returns {Promise<Object>} Statistics object
 */
export const getMetadataStatistics = async (userId) => {
  try {
    const items = await collectMetadataTargets(userId);
    const withRatings = items.filter((item) => !needsMetadataRefresh(item, false));
    const withoutRatings = items.filter((item) => needsMetadataRefresh(item, false));

    const sourceCounts = items.reduce((acc, item) => {
      const key = item.source || "unknown";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const stats = {
      totalItems: items.length,
      itemsWithMetadata: withRatings.length,
      itemsWithoutMetadata: withoutRatings.length,
      completeness: items.length > 0 ? ((withRatings.length / items.length) * 100).toFixed(2) + '%' : '0%',
      averageImdbRating: withRatings.length > 0
        ? (
          withRatings.reduce(
            (sum, item) => sum + (firstNumber(item.imdbRating, item.imdb_rating) || 0),
            0
          ) / withRatings.length
        ).toFixed(2)
        : 'N/A',
      sourceCounts,
      itemsMissingData: withoutRatings.map((item) => ({
        id: item.id || item.docId,
        title: item.title || item.name || item.docId,
        mediaType: deriveTmdbContext(item, item.docId).mediaType,
        source: item.source,
      })),
    };

    return stats;
  } catch (error) {
    console.error("Error getting metadata statistics:", error);
    throw error;
  }
};
