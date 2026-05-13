import {
  doc,
  setDoc,
  getDocs,
  collection,
  deleteDoc,
  getDoc,
  query,
  where,
  orderBy,
  startAfter,
  addDoc,
  limit,
  writeBatch,
  Timestamp,
  documentId,
  arrayRemove,
} from "firebase/firestore";
import { db } from "./firebase";
import { getImdbId } from "../imdb/imdbResolver";
import IMDbService from "../imdb/imdbService";

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed =
    typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

const firstNumber = (...values) => {
  for (const value of values) {
    const numeric = toNumber(value);
    if (numeric !== null) return numeric;
  }
  return null;
};

/**
 * Fetches IMDB rating, votes, and poster image for a media item
 * Ensures numbers are returned (never strings, never "0")
 * 
 * @param {string} tmdbId - The TMDB ID
 * @param {string} mediaType - The media type ('movie' or 'tv')
 * @returns {Promise<Object>} Object with imdbId, imdbRating, imdbVotes, imdbPoster
 */
const fetchImdbData = async (tmdbId, mediaType) => {
  try {
    const imdbService = new IMDbService();
    const imdbId = await getImdbId(tmdbId, mediaType);

    if (!imdbId) {
      console.debug(`No IMDb ID found for TMDB ID: ${tmdbId}`);
      return { imdbId: null, imdbRating: null, imdbVotes: null, imdbPoster: null };
    }

    const titleData = await imdbService.getTitleById(imdbId);

    // Extract and validate rating
    const imdbRating = firstNumber(
      titleData?.rating?.aggregateRating,
      titleData?.rating?.ratingValue,
      titleData?.aggregateRating,
      titleData?.imdbRating
    );

    // Ensure rating is a valid number (not NaN or 0)
    const validRating = (imdbRating && !isNaN(imdbRating) && imdbRating > 0)
      ? imdbRating
      : null;

    // Extract and validate votes
    const imdbVotes = firstNumber(
      titleData?.rating?.voteCount,
      titleData?.rating?.ratingCount,
      titleData?.voteCount,
      titleData?.imdbVotes
    );

    // Ensure votes is a valid number (not NaN or 0)
    const validVotes = (imdbVotes && !isNaN(imdbVotes) && imdbVotes > 0)
      ? imdbVotes
      : null;

    // Extract IMDb poster image
    const imdbPoster = titleData?.primaryImage?.url || null;

    return {
      imdbId: imdbId || null,
      imdbRating: validRating,
      imdbVotes: validVotes,
      imdbPoster: imdbPoster,
    };
  } catch (error) {
    console.warn(`Failed to fetch IMDB data for TMDB ${tmdbId}: ${error.message}`);
    return { imdbId: null, imdbRating: null, imdbVotes: null, imdbPoster: null };
  }
};

export const upsertLibraryItem = async (
  userId,
  mediaItem,
  { status = null, listId = null } = {}
) => {
  const mediaType = mediaItem.media_type || (mediaItem.first_air_date ? "tv" : "movie");
  const rawId = mediaItem.id ?? mediaItem.tmdbId;
  const tmdbId = Number(rawId);

  if (!Number.isFinite(tmdbId)) {
    throw new Error("Invalid TMDB id for library upsert");
  }

  const titleKey = mediaType === "tv" ? `tmdb_tv_${tmdbId}` : `tmdb_movie_${tmdbId}`;
  const ref = doc(db, "users", userId, "library_items", titleKey);
  const existingSnap = await getDoc(ref);
  const existingData = existingSnap.exists() ? existingSnap.data() : {};
  const now = Timestamp.now();

  // Merge list IDs
  const mergedListIds = Array.isArray(existingData?.tracking?.listIds)
    ? [...existingData.tracking.listIds]
    : [];
  if (listId && !mergedListIds.includes(listId)) {
    mergedListIds.push(listId);
  }

  // Normalize ratings
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

  // Normalize release date
  const releaseDate = mediaItem.release_date || 
                      mediaItem.first_air_date || 
                      existingData.releaseDate || 
                      null;

  // Extract IMDb poster if available
  let imdbPoster = mediaItem.imdbPoster || existingData?.images?.imdbPoster || null;

  // If IMDb data is being fetched, also get the poster
  if (mediaItem.imdbId && !imdbPoster) {
    try {
      const imdbData = await fetchImdbData(tmdbId, mediaType);
      imdbPoster = imdbData.imdbPoster;
    } catch (e) {
      console.debug("Could not fetch IMDb poster:", e?.message);
    }
  }

  // Extract genres from TMDB API format (array of objects with 'name' field)
  const extractGenreNames = (genres) => {
    if (!Array.isArray(genres)) return [];
    return genres
      .map(g => typeof g === 'string' ? g : g.name)
      .filter(Boolean);
  };

  // Ensure runtimeMinutes is a valid number or null
  const extractRuntime = (itemOrRuntime) => {
    if (itemOrRuntime == null) return null;
    let runtime = null;
    if (typeof itemOrRuntime === "object") {
      runtime = itemOrRuntime.runtime ??
        // TMDB TV: episode_run_time is often an array
        (Array.isArray(itemOrRuntime.episode_run_time) ? itemOrRuntime.episode_run_time[0] : itemOrRuntime.episode_run_time) ??
        (Array.isArray(itemOrRuntime.episodeRunTime) ? itemOrRuntime.episodeRunTime[0] : itemOrRuntime.episodeRunTime) ??
        itemOrRuntime.runtimeMinutes;
    } else {
      runtime = itemOrRuntime;
    }
    const num = toNumber(runtime);
    return num && num > 0 ? num : null;
  };

  const payload = {
    titleKey,
    mediaType,
    tmdbId,
    imdbId: mediaItem.imdbId || existingData.imdbId || null,
    title: mediaItem.title || mediaItem.name || existingData.title || "",
    images: {
      tmdbPoster: mediaItem.poster_path || existingData?.images?.tmdbPoster || null,
      imdbPoster: imdbPoster,
    },
    releaseDate,
    metadata: {
      genres: extractGenreNames(mediaItem.genres) || extractGenreNames(existingData?.metadata?.genres) || [],
      runtimeMinutes:
        mediaType === "movie"
          ? extractRuntime(mediaItem.runtime) ?? extractRuntime(existingData?.metadata?.runtimeMinutes) ?? null
          : null,
    },
    ratings: {
      imdbScore,
      imdbVotes,
      tmdbScore,
      tmdbVotes,
    },
    tracking: {
      watchStatus: status ?? existingData?.tracking?.watchStatus ?? null,
      listIds: mergedListIds,
      addedAt: existingData?.tracking?.addedAt || now,
      updatedAt: now,
      lastWatchedAt: existingData?.tracking?.lastWatchedAt || null,
    },
  };

  // Add TV-specific progress if needed
  if (mediaType === "tv") {
    payload.tvProgress = existingData?.tvProgress || {
      totalEpisodes: mediaItem.number_of_episodes || null,
      watchedEpisodes: 0,
      completionPercent: 0,
      nextToWatch: null,
    };
  }

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
    await upsertLibraryItem(userId, mediaItem, { status: null, listId: null });
  }

  await setDoc(
    ref,
    {
      "tracking.listIds": normalized,
      "tracking.updatedAt": Timestamp.now(),
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

  const normalizedStatus = status === undefined ? null : status;

  const { ref, titleKey } = resolveLibraryItemRef(userId, mediaItem);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await upsertLibraryItem(userId, mediaItem, { status: null, listId: null });
  }

  await setDoc(
    ref,
    {
      "tracking.watchStatus": normalizedStatus,
      "tracking.updatedAt": Timestamp.now(),
    },
    { merge: true }
  );

  return titleKey;
};



const normalizeLibraryItem = (docId, data = {}) => {
  const titleKey = data.titleKey || docId;
  const match = String(titleKey).match(/^tmdb_(movie|tv)_(\d+)$/);
  const mediaType = data.mediaType || data.media_type || (match ? match[1] : "movie");
  const numericId = match ? Number(match[2]) : Number(data.id);
  const fallbackTitle = match
    ? `${mediaType === "tv" ? "Series" : "Movie"} #${match[2]}`
    : "Untitled";
  const resolvedTitle = data.title || data.name || data.display?.title || fallbackTitle;
  const isFallbackTitle = resolvedTitle === fallbackTitle;
  const normalizedRatings = {
    imdbScore: firstNumber(
      data?.ratings?.imdbScore,
      data.imdbRating,
      data.imdb_rating,
      data?.sort?.imdbRating
    ),
    imdbVotes: firstNumber(
      data?.ratings?.imdbVotes,
      data.imdbVotes,
      data.imdb_vote_count,
      data?.sort?.imdbVotes
    ),
    tmdbScore: firstNumber(
      data?.ratings?.tmdbScore,
      data.vote_average,
      data.tmdb_rating,
      data?.sort?.tmdbRating
    ) ?? 0,
    tmdbVotes: firstNumber(
      data?.ratings?.tmdbVotes,
      data.vote_count,
      data.tmdb_vote_count,
      data?.sort?.tmdbVotes
    ) ?? 0,
  };

  return {
    ...data,
    id: Number.isFinite(numericId) ? numericId : (data.id || titleKey),
    titleKey,
    media_type: mediaType === "tv" ? "tv" : "movie",
    title: resolvedTitle,
    name: data.name || data.title || data.display?.title || resolvedTitle,
    isFallbackTitle,
    poster_path: data.images?.tmdbPoster || data.images?.simklPoster || data.images?.imdbPoster || data.poster_path || data.display?.posterPath || null,
    release_date: data.release_date || data.display?.releaseDate || null,
    first_air_date: data.first_air_date || data.display?.releaseDate || null,
    vote_average: normalizedRatings.tmdbScore,
    vote_count: normalizedRatings.tmdbVotes,
    imdbRating: normalizedRatings.imdbScore,
    imdbVotes: normalizedRatings.imdbVotes,
    ratings: normalizedRatings,
    genres: data.metadata?.genres || data.genres || [],
    dateAdded: data.dateAdded || data?.tracking?.addedAt || data.addedAt || data?.tracking?.updatedAt || null,
  };
};

const timestampToDateString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value?.toDate && typeof value.toDate === "function") {
    return value.toDate().toISOString().split("T")[0];
  }
  if (value instanceof Date) return value.toISOString().split("T")[0];
  return "";
};

const hydrateItemsFromCatalog = async (items) => {
  const needsHydration = items.filter(
    (item) => item?.titleKey && (item.isFallbackTitle || !item.title || !item.poster_path)
  );

  if (needsHydration.length === 0) return items;

  const uniqueTitleKeys = [...new Set(needsHydration.map((i) => i.titleKey))];
  const catalogMap = new Map();

  await Promise.all(
    uniqueTitleKeys.map(async (titleKey) => {
      try {
        const snap = await getDoc(doc(db, "catalog_titles", titleKey));
        if (snap.exists()) catalogMap.set(titleKey, snap.data());
      } catch (err) {
        console.warn("Catalog hydration failed for", titleKey, err?.message || err);
      }
    })
  );

  return items.map((item) => {
    const catalog = catalogMap.get(item.titleKey);
    if (!catalog) return item;

    const releaseDate = timestampToDateString(catalog.releaseDate);
    const catalogTitle = catalog.canonical_title || catalog.title || "Untitled";
    return {
      ...item,
      title: item.isFallbackTitle ? catalogTitle : (item.title || catalogTitle),
      name: item.isFallbackTitle ? catalogTitle : (item.name || catalogTitle),
      poster_path: item.poster_path || catalog.posterPath || catalog.poster_url || "",
      release_date: item.release_date || releaseDate,
      first_air_date: item.first_air_date || releaseDate,
      vote_average:
        typeof item.vote_average === "number" && item.vote_average > 0
          ? item.vote_average
          : (typeof catalog?.ratings?.tmdb === "number" ? catalog.ratings.tmdb : 0),
      isFallbackTitle: false,
    };
  });
};

const hydrateItemsFromTmdb = async (items) => {
  const tmdbKey = import.meta.env.VITE_TMDB_KEY;
  if (!tmdbKey) return items;

  const needsHydration = items.filter(
    (item) => item?.id && (item.isFallbackTitle || !item.title || !item.poster_path || !item.vote_average)
  );

  if (needsHydration.length === 0) return items;

  const tmdbMap = new Map();

  await Promise.all(
    needsHydration.map(async (item) => {
      const mediaType = item.media_type === "tv" ? "tv" : "movie";
      const id = Number(item.id);
      if (!Number.isFinite(id)) return;

      try {
        const res = await fetch(`https://api.themoviedb.org/3/${mediaType}/${id}?language=en-US`, {
          headers: {
            accept: "application/json",
            Authorization: `Bearer ${tmdbKey}`,
          },
        });
        if (!res.ok) return;
        const data = await res.json();
        tmdbMap.set(`${mediaType}:${id}`, data);
      } catch (err) {
        console.warn("TMDB hydration failed for", mediaType, id, err?.message || err);
      }
    })
  );

  return items.map((item) => {
    const mediaType = item.media_type === "tv" ? "tv" : "movie";
    const key = `${mediaType}:${item.id}`;
    const tmdb = tmdbMap.get(key);
    if (!tmdb) return item;

    return {
      ...item,
      title: item.isFallbackTitle ? (tmdb.title || tmdb.name || item.title) : (item.title || tmdb.title || tmdb.name || item.name),
      name: item.isFallbackTitle ? (tmdb.name || tmdb.title || item.name) : (item.name || tmdb.name || tmdb.title || item.title),
      poster_path: item.poster_path || tmdb.poster_path || "",
      release_date: item.release_date || tmdb.release_date || "",
      first_air_date: item.first_air_date || tmdb.first_air_date || "",
      vote_average:
        typeof item.vote_average === "number" && item.vote_average > 0
          ? item.vote_average
          : (typeof tmdb.vote_average === "number" ? tmdb.vote_average : 0),
      vote_count:
        typeof item.vote_count === "number" && item.vote_count > 0
          ? item.vote_count
          : (typeof tmdb.vote_count === "number" ? tmdb.vote_count : 0),
      isFallbackTitle: false,
    };
  });
};

const isIndexRelatedError = (error) => {
  const code = String(error?.code || "").toLowerCase();
  const message = String(error?.message || "").toLowerCase();
  return code.includes("failed-precondition") || message.includes("index") || message.includes("requires an index");
};

// ============================================================================
// NEW ARCHITECTURE: "One Doc, Many Tags" System
// ============================================================================

/**
 * Updates or creates a library item with status (The "God Function")
 * Enforces the single-document schema with status tracking
 * 
 * @param {string} userId - The UID of the user
 * @param {Object} mediaItem - The media item data from TMDB
 * @param {string} status - The status: "plan_to_watch", "watching", "completed", "dropped", or null
 * @returns {Promise<void>}
 */
export const updateLibraryItem = async (userId, mediaItem, status) => {
  try {
    const tmdbId = String(mediaItem.id);
    const mediaType = mediaItem.media_type || (mediaItem.first_air_date ? "tv" : "movie");

    // Reference to the library document
    const itemRef = doc(db, "users", userId, "library", tmdbId);

    // Check if document exists
    const docSnapshot = await getDoc(itemRef);
    const exists = docSnapshot.exists();
    const existingData = exists ? docSnapshot.data() : {};

    // Prepare the base document structure
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

    // Preserve existing progress if any
    if (existingData.progress) {
      libraryItem.progress = existingData.progress;
    }

    // Save to Firestore
    await setDoc(itemRef, libraryItem, { merge: true });

    console.log(`Γ£à Library item updated: ${libraryItem.title} (Status: ${status})`);
    return libraryItem;
  } catch (error) {
    console.error("Error updating library item:", error);
    throw error;
  }
};

/**
 * Toggles a custom list tag on a library item
 * Adds or removes a list ID from the listIds array
 * 
 * @param {string} userId - The UID of the user
 * @param {Object} mediaItem - The media item data from TMDB
 * @param {string} listId - The custom list ID to toggle
 * @param {boolean} add - True to add, false to remove
 * @returns {Promise<void>}
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
 * @param {string} userId - The UID of the user
 * @param {string} tmdbId - The TMDB ID
 * @returns {Promise<Object|null>} The library item or null if not found
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
 * Gets all library items with a specific status
 * @param {string} userId - The UID of the user
 * @param {string} status - The status to filter by (or null for passive items)
 * @returns {Promise<Array>} Array of library items
 */
export const getLibraryByStatus = async (userId, status, options = {}) => {
  try {
    const { sortBy = "updatedAt", sortDirection = "desc", includePageInfo = false, hydrate = true } = options;

    const querySnapshot = await getDocs(collection(db, "users", userId, "library_items"));
    const items = querySnapshot.docs
      .map((d) => normalizeLibraryItem(d.id, d.data()))
      .filter((item) => {
        if (status == null) {
          return !item?.tracking?.watchStatus;
        }
        return item?.tracking?.watchStatus === status;
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
 * @param {string} userId - The UID of the user
 * @param {string} listId - The custom list ID
 * @returns {Promise<Array>} Array of library items
 */
export const getLibraryByListId = async (userId, listId, options = {}) => {
  try {
    const { sortBy = "addedAt", sortDirection = "desc", includePageInfo = false, hydrate = true } = options;

    const querySnapshot = await getDocs(collection(db, "users", userId, "library_items"));
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

/**
 * Creates a new custom list for a user in Firestore.
 * @param {string} userId - The UID of the user from Firebase Auth.
 * @param {Object} listData - The data for the new list (e.g., { name: 'Test List' }).
 * @returns {Promise<string>} - A promise that resolves to the ID of the created list.
 */
export const createCustomList = async (userId, listData) => {
  try {
    const listsRef = collection(db, "users", userId, "lists");
    const newListData = {
      ...listData,
      createdAt: new Date(),
      ownerId: userId,
    };
    const docRef = await addDoc(listsRef, newListData);
    console.log(`Successfully created custom list with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error("Error creating custom list: ", error);
    throw error;
  }
};

/**
 * Deletes a custom list and all its items from Firestore.
 * @param {string} userId - The UID of the user from Firebase Auth.
 * @param {string} listId - The ID of the list to delete.
 */
export const deleteCustomList = async (userId, listId) => {
  try {
    const listRef = doc(db, "users", userId, "lists", listId);
    await deleteDoc(listRef);

    console.log(`Successfully deleted custom list with ID: ${listId}`);
  } catch (error) {
    console.error("Error deleting custom list: ", error);
    throw error;
  }
};

/**
 * Updates a custom list's metadata (name/description).
 * Writes to users/{uid}/lists/{listId}.
 */
export const updateCustomList = async (userId, listId, updates = {}) => {
  if (!userId) throw new Error("Missing userId");
  if (!listId) throw new Error("Missing listId");

  const payload = {
    ...(typeof updates.name === "string" ? { name: updates.name } : {}),
    ...(typeof updates.description === "string"
      ? { description: updates.description }
      : {}),
    updatedAt: Timestamp.now(),
  };

  const listRef = doc(db, "users", userId, "lists", listId);
  await setDoc(listRef, payload, { merge: true });
  return {
    listId,
    ...(typeof payload.name === "string" ? { name: payload.name } : {}),
    ...(typeof payload.description === "string" ? { description: payload.description } : {}),
  };
};

/**
 * Data hygiene: remove a deleted listId from any library items that still reference it.
 * - users/{uid}/library_items where listIds array contains listId
 *
 * Returns number of docs updated.
 */
export const removeListIdFromAllLibraryItems = async (userId, listId, options = {}) => {
  if (!userId) throw new Error("Missing userId");
  if (!listId) throw new Error("Missing listId");

  const pageSize = Math.min(Math.max(Number(options.pageSize) || 400, 1), 450);
  let lastDoc = null;
  let updatedCount = 0;

  while (true) {
    const constraints = [
      where("tracking.listIds", "array-contains", listId),
      orderBy("titleKey"),
      limit(pageSize),
    ];

    if (lastDoc) {
      constraints.splice(2, 0, startAfter(lastDoc));
    }

    const q = query(collection(db, "users", userId, "library_items"), ...constraints);
    const snap = await getDocs(q);

    if (snap.empty) break;

    const batch = writeBatch(db);
    snap.docs.forEach((d) => {
      batch.update(d.ref, { "tracking.listIds": arrayRemove(listId), "tracking.updatedAt": Timestamp.now() });
    });
    await batch.commit();

    updatedCount += snap.docs.length;
    lastDoc = snap.docs[snap.docs.length - 1];

    if (snap.docs.length < pageSize) break;
  }

  return updatedCount;
};

/**
 * Adds an item to a custom list in Firestore.
 * @param {string} userId - The UID of the user from Firebase Auth.
 * @param {string} listId - The ID of the list to add the item to.
 * @param {Object} mediaItem - The media item to add to the list.
 */
export const addItemToCustomList = async (userId, listId, mediaItem) => {
  try {
    await setLibraryItemListIds(userId, mediaItem, [listId]);
    console.log(
      `Successfully added ${mediaItem.title || mediaItem.name} to custom list ${listId}`
    );
  } catch (error) {
    console.error("Error adding item to custom list: ", error);
    throw error;
  }
};

/**
 * Adds multiple items to a custom list in Firestore using batch writes.
 * @param {string} userId - The UID of the user.
 * @param {string} listId - The ID of the list.
 * @param {Array} items - Array of media items to add.
 */
export const addItemsToCustomListBatch = async (userId, listId, items) => {
  try {
    const chunkSize = 450;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const promises = chunk.map((mediaItem) =>
        setLibraryItemListIds(userId, mediaItem, [listId])
      );
      await Promise.all(promises);
      console.log(`Successfully added batch of ${chunk.length} items to list ${listId}`);
    }
    console.log(`Successfully added ${items.length} items to custom list ${listId}`);
  } catch (error) {
    console.error("Error batch adding items to custom list: ", error);
    throw error;
  }
};

/**
 * Removes an item from a custom list in Firestore.
 * @param {string} userId - The UID of the user from Firebase Auth.
 * @param {string} listId - The ID of the list to remove the item from.
 * @param {string|number} mediaId - The ID of the media item to remove.
 */
export const removeItemFromCustomList = async (userId, listId, mediaId) => {
  try {
    const mediaType = mediaId.includes("_tv_") ? "tv" : "movie";
    const numericId = Number(mediaId.split("_").pop());
    const mediaItem = { id: numericId, media_type: mediaType };
    const currentListIds = await getLibraryItemListIds(userId, mediaItem);
    const updatedListIds = currentListIds.filter((id) => id !== listId);
    await setLibraryItemListIds(userId, mediaItem, updatedListIds);
    console.log(
      `Successfully removed item ${mediaId} from custom list ${listId}`
    );
  } catch (error) {
    console.error("Error removing item from custom list: ", error);
    throw error;
  }
};

/**
 * Fetches all custom lists for a user from Firestore.
 * @param {string} userId - The UID of the user.
 * @returns {Promise<Array>} - A promise that resolves to an array of custom list objects.
 */
export const fetchUserLists = async (userId) => {
  try {
    const listsRef = collection(db, "users", userId, "lists");
    const querySnapshot = await getDocs(listsRef);
    const lists = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    return lists;
  } catch (error) {
    console.error("Error fetching user's custom lists: ", error);
    throw error;
  }
};

/**
 * Fetches custom lists with item previews for a user from Firestore.
 * @param {string} userId - The UID of the user.
 * @returns {Promise<Array>} - A promise that resolves to an array of custom lists with first 10 items.
 */
export const fetchUserListsWithPreviews = async (userId) => {
  try {
    const lists = await fetchUserLists(userId);
    return lists;
  } catch (error) {
    console.error("Error fetching user's custom lists with previews: ", error);
    throw error;
  }
};

/**
 * Fetches a custom list and all its items from Firestore.
 * @param {string} userId - The UID of the user.
 * @param {string} listId - The ID of the list to fetch.
 * @returns {Promise<Object>} - A promise that resolves to an object containing the list data and items.
 */
export const fetchListWithItems = async (userId, listId) => {
  try {
    const listRef = doc(db, "users", userId, "lists", listId);
    const listSnap = await getDoc(listRef);

    if (!listSnap.exists()) {
      throw new Error(`List with ID ${listId} does not exist for user ${userId}`);
    }

    const listData = {
      id: listSnap.id,
      ...listSnap.data(),
    };

    return listData;
  } catch (error) {
    console.error("Error fetching list with items: ", error);
    throw error;
  }
};

/**
 * Pins a custom list for a user.
 * @param {string} userId - The UID of the user.
 * @param {string} listId - The ID of the list to pin.
 */
export const pinList = async (userId, listId) => {
  try {
    const listRef = doc(db, "users", userId, "lists", listId);
    await setDoc(
      listRef,
      {
        isPinned: true,
        pinnedAt: new Date(),
      },
      { merge: true }
    );
    console.log(`Successfully pinned list ${listId}`);
  } catch (error) {
    console.error("Error pinning list: ", error);
    throw error;
  }
};

/**
 * Unpins a custom list for a user.
 * @param {string} userId - The UID of the user.
 * @param {string} listId - The ID of the list to unpin.
 */
export const unpinList = async (userId, listId) => {
  try {
    const listRef = doc(db, "users", userId, "lists", listId);
    await setDoc(
      listRef,
      {
        isPinned: false,
        pinnedAt: null,
      },
      { merge: true }
    );
    console.log(`Successfully unpinned list ${listId}`);
  } catch (error) {
    console.error("Error unpinning list: ", error);
    throw error;
  }
};

/**
 * Creates a default "Watch Later" pinned list for new users.
 * @param {string} userId - The UID of the user.
 * @returns {Promise<string>} - The ID of the created list.
 */
export const createDefaultWatchLaterList = async (userId) => {
  try {
    const existingLists = await fetchUserLists(userId);
    const existingWatchLater = existingLists.find(
      (list) => (list.name || "").toLowerCase() === "watch later"
    );

    if (existingWatchLater) {
      return existingWatchLater.id;
    }

    const listsRef = collection(db, "users", userId, "lists");
    const newListData = {
      name: "Watch Later",
      description: "Your default watch later list",
      createdAt: new Date(),
      ownerId: userId,
      isPinned: true,
      pinnedAt: new Date(),
    };
    const docRef = await addDoc(listsRef, newListData);
    console.log(
      `Successfully created default Watch Later list with ID: ${docRef.id}`
    );
    return docRef.id;
  } catch (error) {
    console.error("Error creating default Watch Later list: ", error);
    throw error;
  }
};

/**
 * Updates an item with enriched data (ratings, posters, etc.)
 * @param {string} userId
 * @param {string} listId
 * @param {string} itemId
 * @param {Object} enrichedData
 */
export const updateItemEnrichment = async (
  userId,
  itemId,
  enrichedData
) => {
  try {
    const libraryItemRef = doc(db, "users", userId, "library_items", String(itemId));
    await setDoc(
      libraryItemRef,
      {
        ...enrichedData,
          "tracking.updatedAt": Timestamp.now(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error(`Failed to enrich item ${itemId}:`, error);
    throw error;
  }
};

/**
 * Fetches items that need enrichment from a specific list
 * @param {string} userId
 * @param {string} listId
 * @param {number} limitCount
 */
export const getPendingItemsInList = async (userId, listId, limitCount = 5) => {
  try {
    const libraryItemsRef = collection(db, "users", userId, "library_items");
    const q = query(
      libraryItemsRef,
      where("tracking.listIds", "array-contains", listId),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error fetching items in list:", error);
    return [];
  }
};

// ============================================================================
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
    const tmdbKey = import.meta.env.VITE_TMDB_KEY;
    if (!tmdbKey || !tmdbId) return null;

    const response = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?language=en-US`, {
      headers: {
        accept: "application/json",
        Authorization: `Bearer ${tmdbKey}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
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
    imdbRating,
    imdbVotes,
    imdb_rating: imdbRating,
    imdb_vote_count: imdbVotes,
    vote_average: voteAverage,
    vote_count: voteCount,
    tmdb_rating: voteAverage,
    tmdb_vote_count: voteCount,
    sort: {
      ...(item.sort || {}),
      tmdbRating: voteAverage,
      tmdbVotes: voteCount,
      imdbRating: imdbRating ?? null,
      imdbVotes: imdbVotes ?? null,
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

    console.log(`≡ƒöä Starting metadata refresh for ${itemsToRefresh.length} items (batch size: ${batchSize})`);

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

        const { tmdbId, mediaType } = deriveTmdbContext(item, item.docId);
        if (!tmdbId) {
          throw new Error("Missing TMDB id");
        }

        const imdbData = await fetchImdbData(tmdbId, mediaType);
        const tmdbData = await fetchTmdbMetadata(tmdbId, mediaType);
        const patch = buildMetadataPatch(item, imdbData, tmdbData);

        if (patch.imdbRating !== null || patch.imdbId || patch.vote_count > 0) {
          await setDoc(item.docRef, patch, { merge: true });

          summary.refreshed++;
          if (summary.bySource[item.source] !== undefined) {
            summary.bySource[item.source] += 1;
          }
          console.log(`Γ£à Refreshed: ${item.title || item.name || item.docId} (${item.source})`);
        } else {
          console.warn(`ΓÜá∩╕Å No metadata found for: ${item.title || item.name || item.docId}`);
        }
      } catch (error) {
        summary.failed++;
        summary.errors.push({
          itemId: item.id || item.docId,
          title: item.title || item.name || item.docId,
          source: item.source,
          error: error.message,
        });
        console.error(`Γ¥î Failed to refresh ${item.title || item.name || item.docId}:`, error.message);
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
 * Refreshes metadata for a specific custom list
 * Useful for bulk updates to a curated collection
 * 
 * @param {string} userId - The UID of the user
 * @param {string} listId - The custom list ID
 * @param {object} options - Configuration options
 * @param {number} options.batchSize - Number of items to process
 * @param {function} options.onProgress - Callback for progress updates
 * @returns {Promise<object>} Summary of refresh operation
 */
export const refreshCustomListMetadata = async (
  userId,
  listId,
  options = {}
) => {
  const {
    batchSize = 50,
    onProgress = null,
  } = options;

  try {
    // Get all items in the custom list
    const items = await getLibraryByListId(userId, listId);

    // Filter items that need refresh
    const itemsToRefresh = items
      .filter(item => item.imdbRating === null || item.imdbRating === undefined || !item.imdbId)
      .slice(0, batchSize);

    const summary = {
      listId,
      totalItems: items.length,
      itemsToRefresh: itemsToRefresh.length,
      refreshed: 0,
      failed: 0,
      errors: [],
      startTime: new Date(),
    };

    console.log(`≡ƒöä Refreshing metadata for custom list "${listId}" (${itemsToRefresh.length} items)`);

    for (let i = 0; i < itemsToRefresh.length; i++) {
      const item = itemsToRefresh[i];

      try {
        if (onProgress) {
          onProgress({
            current: i + 1,
            total: itemsToRefresh.length,
            itemTitle: item.title,
          });
        }

        const imdbData = await fetchImdbData(item.id, item.media_type);

        if (imdbData.imdbRating !== null || imdbData.imdbId) {
          // Update in library
          const itemRef = doc(db, "users", userId, "library", item.id);
          await setDoc(
            itemRef,
            {
              imdbRating: imdbData.imdbRating,
              imdbVotes: imdbData.imdbVotes,
              imdbId: imdbData.imdbId,
              lastMetadataRefresh: new Date().toISOString(),
            },
            { merge: true }
          );

          summary.refreshed++;
          console.log(`Γ£à Refreshed: ${item.title}`);
        }
      } catch (error) {
        summary.failed++;
        summary.errors.push({
          itemId: item.id,
          title: item.title,
          error: error.message,
        });
        console.error(`Γ¥î Failed: ${item.title}`);
      }

      // Delay between requests
      if (i < itemsToRefresh.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    summary.endTime = new Date();
    summary.duration = summary.endTime - summary.startTime;

    console.log(`Γ£à Custom list refresh complete:`, summary);
    return summary;
  } catch (error) {
    console.error("Error refreshing custom list metadata:", error);
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

