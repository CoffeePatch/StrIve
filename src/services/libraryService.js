import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  deleteField,
  Timestamp,
  query,
  where
} from 'firebase/firestore';
import { db } from '../util/firebase/firebase';
import { firstNumber, fetchImdbData } from '../util/firebase/firestoreService';
import { hydrateItemsFromCatalog, hydrateItemsFromTmdb, normalizeLibraryItem } from './tmdbHydrationService';
import { normalizeWatchStatus } from '../util/library/watchStatus';

const normalizeGenres = (genres) => {
  if (!Array.isArray(genres)) return [];
  return genres
    .map((genre) => {
      if (typeof genre === 'string') {
        const name = genre.trim();
        return name ? name : null;
      }
      if (!genre || typeof genre !== 'object') return null;
      const normalizedName = typeof genre.name === 'string' ? genre.name.trim() : '';
      return normalizedName || null;
    })
    .filter(Boolean);
};

const extractRuntime = (itemOrRuntime) => {
  if (itemOrRuntime == null) return null;
  let runtime = null;
  if (typeof itemOrRuntime === 'object') {
    runtime = itemOrRuntime.runtime ??
      (Array.isArray(itemOrRuntime.episode_run_time) ? itemOrRuntime.episode_run_time[0] : itemOrRuntime.episode_run_time) ??
      (Array.isArray(itemOrRuntime.episodeRunTime) ? itemOrRuntime.episodeRunTime[0] : itemOrRuntime.episodeRunTime) ??
      itemOrRuntime.runtimeMinutes;
  } else {
    runtime = itemOrRuntime;
  }
  const num = Number(runtime);
  return num && num > 0 && !isNaN(num) ? num : null;
};

export const buildLibraryPayload = async (mediaItem, existingData, options = {}) => {
  const { status = null, listId = null, titleKey, mediaType, tmdbId, isUserInteraction = false } = options;
  const now = Timestamp.now();

  const mergedListIds = Array.isArray(existingData?.tracking?.listIds)
    ? [...existingData.tracking.listIds]
    : [];
  if (listId && !mergedListIds.includes(listId)) {
    mergedListIds.push(listId);
  }

  const tmdbScore = firstNumber(
    mediaItem?.ratings?.tmdbScore,
    mediaItem.vote_average,
    existingData?.ratings?.tmdbScore
  ) ?? 0;

  const tmdbVotes = firstNumber(
    mediaItem?.ratings?.tmdbVotes,
    mediaItem.vote_count,
    existingData?.ratings?.tmdbVotes
  ) ?? 0;

  const imdbScore = firstNumber(
    mediaItem?.ratings?.imdbScore,
    mediaItem.imdbRating,
    existingData?.ratings?.imdbScore
  ) ?? null;

  const imdbVotes = firstNumber(
    mediaItem?.ratings?.imdbVotes,
    mediaItem.imdbVotes,
    existingData?.ratings?.imdbVotes
  ) ?? null;

  const releaseDate = mediaItem.release_date || 
                      mediaItem.first_air_date || 
                      existingData.releaseDate || 
                      null;

  let imdbPoster = mediaItem.imdbPoster || existingData?.images?.imdbPoster || null;
  if (mediaItem.imdbId && !imdbPoster) {
    try {
      const imdbData = await fetchImdbData(tmdbId, mediaType);
      imdbPoster = imdbData.imdbPoster;
    } catch (e) {
      console.debug('Could not fetch IMDb poster:', e?.message);
    }
  }

  const normalizedStatus = status == null
    ? undefined
    : (normalizeWatchStatus(status) ?? status);

  const payload = {
    titleKey,
    mediaType,
    tmdbId,
    imdbId: mediaItem.imdbId || existingData.imdbId || null,
    title: mediaItem.title || mediaItem.name || existingData.title || '',
    images: {
      tmdbPoster: mediaItem.poster_path || existingData?.images?.tmdbPoster || null,
      imdbPoster,
    },
    releaseDate,
    metadata: {
      genres: normalizeGenres(mediaItem.genres).length > 0
        ? normalizeGenres(mediaItem.genres)
        : normalizeGenres(existingData?.metadata?.genres),
      ...(mediaType === 'movie'
        ? {
            runtimeMinutes: extractRuntime(mediaItem.runtime) ?? extractRuntime(existingData?.metadata?.runtimeMinutes) ?? null,
          }
        : {
            runtimeMinutes: deleteField(),
          }),
    },
    ratings: {
      imdbScore,
      imdbVotes,
      tmdbScore,
      tmdbVotes,
    },
    tracking: {
      watchStatus: normalizedStatus ?? existingData?.tracking?.watchStatus ?? null,
      listIds: mergedListIds,
      addedAt: existingData?.tracking?.addedAt || now,
      updatedAt: now,
      lastWatchedAt: existingData?.tracking?.lastWatchedAt || null,
      ...(isUserInteraction 
        ? { lastUserInteractionAt: now } 
        : existingData?.tracking?.lastUserInteractionAt ? { lastUserInteractionAt: existingData.tracking.lastUserInteractionAt } : {})
    },
  };

  if (mediaType === 'tv') {
    payload.tvProgress = existingData?.tvProgress || {
      totalEpisodes: mediaItem.number_of_episodes || null,
      watchedEpisodes: 0,
      completionPercent: 0,
      nextToWatch: null,
    };
  }

  return payload;
};

export const upsertLibraryItem = async (
  userId,
  mediaItem,
  { status = null, listId = null, isUserInteraction = false } = {}
) => {
  const mediaType = mediaItem.media_type || (mediaItem.first_air_date ? 'tv' : 'movie');
  const rawId = mediaItem.id ?? mediaItem.tmdbId;
  const tmdbId = Number(rawId);

  if (!Number.isFinite(tmdbId)) {
    throw new Error('Invalid TMDB id for library upsert');
  }

  const titleKey = mediaType === 'tv' ? `tmdb_tv_${tmdbId}` : `tmdb_movie_${tmdbId}`;
  const ref = doc(db, 'users', userId, 'library_items', titleKey);
  const existingSnap = await getDoc(ref);
  const existingData = existingSnap.exists() ? existingSnap.data() : {};

  const payload = await buildLibraryPayload(mediaItem, existingData, { status, listId, titleKey, mediaType, tmdbId, isUserInteraction });

  await setDoc(ref, payload, { merge: true });
  return titleKey;
};

const resolveMediaType = (mediaItem) => {
  return (
    mediaItem?.media_type ||
    mediaItem?.mediaType ||
    (mediaItem?.first_air_date ? "tv" : "movie")
  );
};

const resolveTmdbIdNumber = (mediaItem) => {
  const rawId = mediaItem?.id ?? mediaItem?.tmdbId;
  return Number(rawId);
};

const resolveLibraryItemRef = (userId, mediaItem) => {
  const mediaType = resolveMediaType(mediaItem);
  const tmdbId = resolveTmdbIdNumber(mediaItem);
  if (!Number.isFinite(tmdbId)) {
    throw new Error("Invalid TMDB id for library read/write");
  }
  const titleKey = mediaType === "tv" ? `tmdb_tv_${tmdbId}` : `tmdb_movie_${tmdbId}`;
  return {
    titleKey,
    ref: doc(db, "users", userId, "library_items", titleKey),
  };
};

/**
 * Returns listIds for a media item from library_items.
 */
export const getLibraryItemListIds = async (userId, mediaItem) => {
  if (!userId || !mediaItem?.id) return [];

  try {
    const { ref } = resolveLibraryItemRef(userId, mediaItem);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      return Array.isArray(data?.tracking?.listIds) ? data.tracking.listIds : [];
    }
  } catch (err) {
    console.error("Failed to get list IDs for item:", err?.message || err);
  }

  return [];
};

/**
 * Sets the listIds array for the library item.
 */
export const setLibraryItemListIds = async (userId, mediaItem, listIds) => {
  if (!userId) throw new Error("Missing userId");
  if (!mediaItem?.id) throw new Error("Missing media item id");

  const normalized = Array.isArray(listIds)
    ? [...new Set(listIds.filter(Boolean))]
    : [];

  const { ref, titleKey } = resolveLibraryItemRef(userId, mediaItem);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await upsertLibraryItem(userId, mediaItem, { status: null, listId: null, isUserInteraction: true });
  }

  await setDoc(
    ref,
    {
      tracking: {
        ...(snap.exists() ? snap.data()?.tracking || {} : {}),
        listIds: normalized,
        updatedAt: Timestamp.now(),
        lastUserInteractionAt: Timestamp.now(),
      },
    },
    { merge: true }
  );

  return titleKey;
};

/**
 * Sets the status field for the library item.
 */
export const setLibraryItemStatus = async (userId, mediaItem, status) => {
  if (!userId) throw new Error("Missing userId");
  if (!mediaItem?.id) throw new Error("Missing media item id");

  const normalizedStatus = status === undefined
    ? null
    : (normalizeWatchStatus(status) ?? status);

  const { ref, titleKey } = resolveLibraryItemRef(userId, mediaItem);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await upsertLibraryItem(userId, mediaItem, { status: null, listId: null, isUserInteraction: true });
  }

  await setDoc(
    ref,
    {
      tracking: {
        ...(snap.exists() ? snap.data()?.tracking || {} : {}),
        watchStatus: normalizedStatus,
        updatedAt: Timestamp.now(),
        lastUserInteractionAt: Timestamp.now(),
      },
    },
    { merge: true }
  );

  return titleKey;
};

export {
  normalizeLibraryItem,
  hydrateItemsFromCatalog,
  hydrateItemsFromTmdb
} from './tmdbHydrationService';



/**
 * Updates or creates a library item with status
 * @param {string} userId - The UID of the user
 * @param {Object} mediaItem - The media item data from TMDB
 * @param {string} status - The status: "plan_to_watch", "watching", "completed", "dropped", or null
 */
export const updateLibraryItem = async (userId, mediaItem, status) => {
  try {
    const tmdbId = String(mediaItem.id);
    const mediaType = mediaItem.media_type || (mediaItem.first_air_date ? "tv" : "movie");

    const itemRef = doc(db, "users", userId, "library", tmdbId);
    const docSnapshot = await getDoc(itemRef);
    const exists = docSnapshot.exists();
    const existingData = exists ? docSnapshot.data() : {};

    const libraryItem = {
      id: tmdbId,
      media_type: mediaType,
      title: mediaItem.title || mediaItem.name || existingData.title || "",
      poster_path: mediaItem.poster_path || existingData.poster_path || "",
      release_date: mediaItem.release_date || mediaItem.first_air_date || existingData.release_date || "",
      vote_average: mediaItem.vote_average || existingData.vote_average || 0,
      vote_count: mediaItem.vote_count || existingData.vote_count || 0,
      status: status,
      dateAdded: existingData.dateAdded || new Date().toISOString(),
      listIds: existingData.listIds || [],
    };

    libraryItem.ratings = {
      imdbScore: firstNumber(
        mediaItem?.ratings?.imdbScore,
        mediaItem.imdbRating,
        mediaItem.imdb_rating,
        existingData?.ratings?.imdbScore,
        existingData.imdbRating,
        existingData.imdb_rating
      ),
      imdbVotes: firstNumber(
        mediaItem?.ratings?.imdbVotes,
        mediaItem.imdbVotes,
        mediaItem.imdb_vote_count,
        existingData?.ratings?.imdbVotes,
        existingData.imdbVotes,
        existingData.imdb_vote_count
      ),
      tmdbScore: firstNumber(
        mediaItem?.ratings?.tmdbScore,
        mediaItem.vote_average,
        existingData?.ratings?.tmdbScore,
        existingData.vote_average
      ) ?? 0,
      tmdbVotes: firstNumber(
        mediaItem?.ratings?.tmdbVotes,
        mediaItem.vote_count,
        existingData?.ratings?.tmdbVotes,
        existingData.vote_count
      ) ?? 0,
    };

    if (existingData.progress) {
      libraryItem.progress = existingData.progress;
    }

    await setDoc(itemRef, libraryItem, { merge: true });
    return libraryItem;
  } catch (error) {
    console.error("Error updating library item:", error);
    throw error;
  }
};

/**
 * Toggles a custom list tag on a library item
 */
export const toggleCustomListTag = async (userId, mediaItem, listId, add = true) => {
  try {
    const currentListIds = await getLibraryItemListIds(userId, mediaItem);
    let updatedListIds;

    if (add) {
      if (!currentListIds.includes(listId)) {
        updatedListIds = [...currentListIds, listId];
      } else {
        return;
      }
    } else {
      updatedListIds = currentListIds.filter((id) => id !== listId);
    }

    await setLibraryItemListIds(userId, mediaItem, updatedListIds);
  } catch (error) {
    console.error("Error toggling custom list tag:", error);
    throw error;
  }
};

/**
 * Gets a single library item
 */
export const getLibraryItem = async (userId, tmdbId) => {
  try {
    const itemRef = doc(db, "users", userId, "library", String(tmdbId));
    const docSnapshot = await getDoc(itemRef);

    if (docSnapshot.exists()) {
      return docSnapshot.data();
    }
    return null;
  } catch (error) {
    console.error("Error getting library item:", error);
    throw error;
  }
};

/**
 * Gets all library items
 */
export const getAllLibraryItems = async (userId, options = {}) => {
  try {
    const { sortBy = "updatedAt", sortDirection = "desc", includePageInfo = false, hydrate = true } = options;

    const q = query(
      collection(db, "users", userId, "library_items"),
      where("tracking.watchStatus", "!=", null)
    );
    const querySnapshot = await getDocs(q);
    const items = querySnapshot.docs
      .map((d) => normalizeLibraryItem(d.id, d.data()));

    const sortValue = (item) => {
      if (sortBy === "sort.imdbRating") {
        return Number(item?.ratings?.imdbScore ?? item?.sort?.imdbRating) || 0;
      }
      if (sortBy === "sort.year") return Number(item?.sort?.year) || 0;
      if (sortBy === "updatedAt") {
        const value = item?.tracking?.updatedAt || item?.tracking?.addedAt || item?.addedAt || null;
        return value?.toMillis ? value.toMillis() : new Date(value || 0).getTime();
      }
      return 0;
    };

    const direction = sortDirection === "asc" ? 1 : -1;
    const sortedItems = [...items].sort((left, right) => (sortValue(left) - sortValue(right)) * direction);

    let hydratedItems = sortedItems;
    if (hydrate) {
      try {
        const catalogHydrated = await hydrateItemsFromCatalog(sortedItems);
        hydratedItems = await hydrateItemsFromTmdb(catalogHydrated);
      } catch (hydrateError) {
        console.warn("Hydration skipped for getAllLibraryItems:", hydrateError?.message || hydrateError);
      }
    }

    if (includePageInfo) {
      return { items: hydratedItems, hasMore: false, nextCursor: null };
    }

    return hydratedItems;
  } catch (error) {
    console.error("Error getting all library items:", error);
    throw error;
  }
};

/**
 * Gets all library items with a specific status
 */
export const getLibraryByStatus = async (userId, status, options = {}) => {
  try {
    const { sortBy = "updatedAt", sortDirection = "desc", includePageInfo = false, hydrate = true } = options;

    const targetStatus = normalizeWatchStatus(status);

    const q = query(
      collection(db, "users", userId, "library_items"),
      where("tracking.watchStatus", "==", targetStatus)
    );
    const querySnapshot = await getDocs(q);
    const items = querySnapshot.docs
      .map((d) => normalizeLibraryItem(d.id, d.data()))
      .filter((item) => {
        const itemStatus = normalizeWatchStatus(
          item?.tracking?.watchStatus ?? item?.watchStatus ?? item?.status
        );

        if (targetStatus == null) {
          return !itemStatus;
        }

        return itemStatus === targetStatus;
      });

    const sortValue = (item) => {
      if (sortBy === "sort.imdbRating") {
        return Number(item?.ratings?.imdbScore ?? item?.sort?.imdbRating) || 0;
      }
      if (sortBy === "sort.year") return Number(item?.sort?.year) || 0;
      if (sortBy === "updatedAt") {
        const value = item?.tracking?.updatedAt || item?.tracking?.addedAt || item?.addedAt || null;
        return value?.toMillis ? value.toMillis() : new Date(value || 0).getTime();
      }
      return 0;
    };

    const direction = sortDirection === "asc" ? 1 : -1;
    const sortedItems = [...items].sort((left, right) => (sortValue(left) - sortValue(right)) * direction);

    let hydratedItems = sortedItems;
    if (hydrate) {
      try {
        const catalogHydrated = await hydrateItemsFromCatalog(sortedItems);
        hydratedItems = await hydrateItemsFromTmdb(catalogHydrated);
      } catch (hydrateError) {
        console.warn("Hydration skipped for getLibraryByStatus:", hydrateError?.message || hydrateError);
      }
    }

    if (includePageInfo) {
      return { items: hydratedItems, hasMore: false, nextCursor: null };
    }

    return hydratedItems;
  } catch (error) {
    console.error("Error getting library by status:", error);
    throw error;
  }
};

/**
 * Gets all library items tagged with a specific custom list ID
 */
export const getLibraryByListId = async (userId, listId, options = {}) => {
  try {
    const { sortBy = "addedAt", sortDirection = "desc", includePageInfo = false, hydrate = true } = options;

    const q = query(
      collection(db, "users", userId, "library_items"),
      where("tracking.listIds", "array-contains", listId)
    );
    const querySnapshot = await getDocs(q);
    const items = querySnapshot.docs
      .map((d) => normalizeLibraryItem(d.id, d.data()))
      .filter((item) => Array.isArray(item?.tracking?.listIds) && item.tracking.listIds.includes(listId));

    const sortValue = (item) => {
      if (sortBy === "sort.imdbRating") {
        return Number(item?.ratings?.imdbScore ?? item?.sort?.imdbRating) || 0;
      }
      if (sortBy === "position") return Number(item?.position) || 0;
      if (sortBy === "addedAt") {
        const value = item?.addedAt || item?.tracking?.addedAt || item?.tracking?.updatedAt || null;
        return value?.toMillis ? value.toMillis() : new Date(value || 0).getTime();
      }
      return 0;
    };

    const direction = sortDirection === "asc" ? 1 : -1;
    const sortedItems = [...items].sort((left, right) => (sortValue(left) - sortValue(right)) * direction);

    let hydratedItems = sortedItems;
    if (hydrate) {
      try {
        const catalogHydrated = await hydrateItemsFromCatalog(sortedItems);
        hydratedItems = await hydrateItemsFromTmdb(catalogHydrated);
      } catch (hydrateError) {
        console.warn("Hydration skipped for getLibraryByListId:", hydrateError?.message || hydrateError);
      }
    }

    if (includePageInfo) {
      return { items: hydratedItems, hasMore: false, nextCursor: null };
    }

    return hydratedItems;
  } catch (error) {
    console.error("Error getting library by list ID:", error);
    throw error;
  }
};