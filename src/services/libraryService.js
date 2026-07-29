import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  deleteDoc,
  deleteField,
  Timestamp,
  query,
  where
} from 'firebase/firestore';
import { db } from '../util/firebase/firebase';
import { firstNumber, fetchImdbData } from '../util/firebase/firestoreService';
import { hydrateItemsFromCatalog, hydrateItemsFromTmdb, normalizeLibraryItem } from './tmdbHydrationService';
import { normalizeWatchStatus } from '../util/library/watchStatus';
import tmdbApiService from './tmdb/tmdbApiService';

const selfHealLibraryItems = (userId, items) => {
  if (!userId || !Array.isArray(items)) return;
  const itemsNeedHeal = items.filter(item => item?.id && !item.poster_path);
  if (itemsNeedHeal.length === 0) return;

  // Process in background
  (async () => {
    console.debug(`[Self-Healing] Found ${itemsNeedHeal.length} items lacking poster path. Repairing...`);
    for (const item of itemsNeedHeal) {
      const mediaType = item.media_type === "tv" ? "tv" : "movie";
      const id = Number(item.id);
      if (!Number.isFinite(id)) continue;
      try {
        const data = await tmdbApiService.get(`/${mediaType}/${id}`, { language: 'en-US' });
        if (data && (data.poster_path || data.backdrop_path)) {
          const titleKey = item.titleKey || (mediaType === 'tv' ? `tmdb_tv_${id}` : `tmdb_movie_${id}`);
          const docRef = doc(db, 'users', userId, 'library_items', titleKey);
          await setDoc(docRef, {
            images: {
              tmdbPoster: data.poster_path || null,
              tmdbBackdrop: data.backdrop_path || null
            }
          }, { merge: true });
          console.debug(`[Self-Healing] Successfully repaired poster/backdrop for ${titleKey}`);
        }
      } catch (err) {
        console.warn(`[Self-Healing] Failed to repair ${mediaType} ${id}:`, err?.message || err);
      }
    }
  })();
};

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
  const { status = null, listId = null, titleKey, mediaType, tmdbId, isUserInteraction = false, watchedAt = null } = options;
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
                      mediaItem.releaseDate || 
                      mediaItem.firstAirDate || 
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

  const targetStatus = normalizedStatus ?? existingData?.tracking?.watchStatus ?? null;
  const isNewlyCompleted = targetStatus === 'completed' && existingData?.tracking?.watchStatus !== 'completed';
  const lastWatchedAt = watchedAt 
    ? (watchedAt instanceof Timestamp ? watchedAt : Timestamp.fromDate(new Date(watchedAt)))
    : (isNewlyCompleted ? now : (existingData?.tracking?.lastWatchedAt || null));

  const payload = {
    titleKey,
    mediaType,
    tmdbId,
    imdbId: mediaItem.imdbId || existingData.imdbId || null,
    title: mediaItem.title || mediaItem.name || existingData.title || '',
    enrichmentStatus: existingData?.enrichmentStatus || "pending",
    enrichmentRetryCount: existingData?.enrichmentRetryCount ?? 0,
    lastEnrichmentAttempt: existingData?.lastEnrichmentAttempt ?? null,
    nextEnrichmentAttempt: existingData?.nextEnrichmentAttempt ?? null,
    images: {
      tmdbPoster: mediaItem.poster_path || mediaItem.posterPath || existingData?.images?.tmdbPoster || null,
      tmdbBackdrop: mediaItem.backdrop_path || mediaItem.backdropPath || existingData?.images?.tmdbBackdrop || null,
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
      imdbScore,
      imdbVotes,
      tmdbScore,
      tmdbVotes,
    },
    tracking: {
      watchStatus: targetStatus,
      listIds: mergedListIds,
      addedAt: existingData?.tracking?.addedAt || now,
      updatedAt: now,
      lastWatchedAt,
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

  const currentSnap = snap.exists() ? snap : await getDoc(ref);
  const existingData = currentSnap.data();
  const existingTracking = existingData?.tracking || {};
  const addedAt = existingTracking.addedAt || Timestamp.now();

  await setDoc(
    ref,
    {
      tracking: {
        ...existingTracking,
        listIds: normalized,
        addedAt,
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
export const setLibraryItemStatus = async (userId, mediaItem, status, options = {}) => {
  if (!userId) throw new Error("Missing userId");
  if (!mediaItem?.id) throw new Error("Missing media item id");

  const normalizedStatus = status === undefined
    ? null
    : (normalizeWatchStatus(status) ?? status);

  const { ref, titleKey } = resolveLibraryItemRef(userId, mediaItem);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await upsertLibraryItem(userId, mediaItem, { status: normalizedStatus, listId: null, isUserInteraction: true, watchedAt: options.watchedAt });
    return titleKey;
  }

  const existingData = snap.data();
  const existingTracking = existingData?.tracking || {};
  const isNewlyCompleted = normalizedStatus === 'completed' && existingTracking.watchStatus !== 'completed';
  const addedAt = existingTracking.addedAt || Timestamp.now();
  
  let lastWatchedAt;
  if (options.watchedAt) {
    lastWatchedAt = options.watchedAt instanceof Timestamp ? options.watchedAt : Timestamp.fromDate(new Date(options.watchedAt));
  } else {
    lastWatchedAt = isNewlyCompleted ? Timestamp.now() : (existingTracking.lastWatchedAt || null);
  }

  await setDoc(
    ref,
    {
      tracking: {
        ...existingTracking,
        watchStatus: normalizedStatus,
        addedAt,
        lastWatchedAt,
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

    selfHealLibraryItems(userId, items);

    const sortValue = (item) => {
      if (sortBy === "sort.imdbRating") {
        return Number(item?.ratings?.imdbScore ?? item?.sort?.imdbRating) || 0;
      }
      if (sortBy === "sort.year") {
        const yearVal = item?.sort?.year;
        if (yearVal) return Number(yearVal);
        const dateStr = item?.releaseDate || item?.release_date || item?.first_air_date;
        if (dateStr) {
          const yearMatch = String(dateStr).match(/\d{4}/);
          if (yearMatch) return parseInt(yearMatch[0], 10);
        }
        return 0;
      }
      if (sortBy === "addedAt" || sortBy === "tracking.addedAt") {
        const value = item?.tracking?.addedAt || item?.addedAt || item?.tracking?.updatedAt || null;
        return value?.toMillis ? value.toMillis() : new Date(value || 0).getTime();
      }
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
    const { sortBy = "updatedAt", sortDirection = "desc", includePageInfo = false, hydrate = true, limit: limitCount } = options;

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

    selfHealLibraryItems(userId, items);

    const sortValue = (item) => {
      if (sortBy === "sort.imdbRating") {
        return Number(item?.ratings?.imdbScore ?? item?.sort?.imdbRating) || 0;
      }
      if (sortBy === "sort.year") {
        const yearVal = item?.sort?.year;
        if (yearVal) return Number(yearVal);
        const dateStr = item?.releaseDate || item?.release_date || item?.first_air_date;
        if (dateStr) {
          const yearMatch = String(dateStr).match(/\d{4}/);
          if (yearMatch) return parseInt(yearMatch[0], 10);
        }
        return 0;
      }
      if (sortBy === "updatedAt") {
        const value = item?.tracking?.updatedAt || item?.tracking?.addedAt || item?.addedAt || null;
        return value?.toMillis ? value.toMillis() : new Date(value || 0).getTime();
      }
      return 0;
    };

    const direction = sortDirection === "asc" ? 1 : -1;
    const sortedItems = [...items].sort((left, right) => (sortValue(left) - sortValue(right)) * direction);

    const limitedItems = limitCount ? sortedItems.slice(0, limitCount) : sortedItems;

    let hydratedItems = limitedItems;
    if (hydrate) {
      try {
        const catalogHydrated = await hydrateItemsFromCatalog(limitedItems);
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

    selfHealLibraryItems(userId, items);

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

/**
 * Deletes a library item document entirely.
 */
export const deleteLibraryItem = async (userId, mediaItem) => {
  if (!userId) throw new Error("Missing userId");
  if (!mediaItem) throw new Error("Missing media item");

  const { ref, titleKey } = resolveLibraryItemRef(userId, mediaItem);
  await deleteDoc(ref);
  return titleKey;
};