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
} from "firebase/firestore";
import { db } from "./firebase";
import { getImdbId } from "./imdbResolver";
import IMDbService from "./imdbService";

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
 * Fetches IMDB rating and votes for a media item
 * Ensures numbers are returned (never strings, never "0")
 * 
 * @param {string} tmdbId - The TMDB ID
 * @param {string} mediaType - The media type ('movie' or 'tv')
 * @returns {Promise<Object>} Object with imdbRating (float), imdbVotes (int), and imdbId
 */
const fetchImdbData = async (tmdbId, mediaType) => {
  try {
    const imdbService = new IMDbService();
    const imdbId = await getImdbId(tmdbId, mediaType);

    if (!imdbId) {
      console.debug(`No IMDb ID found for TMDB ID: ${tmdbId}`);
      return { imdbId: null, imdbRating: null, imdbVotes: null };
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

    return {
      imdbId: imdbId || null,
      imdbRating: validRating, // Float or null (NEVER 0 or "0")
      imdbVotes: validVotes,   // Integer or null (NEVER 0)
    };
  } catch (error) {
    console.warn(`Failed to fetch IMDB data for TMDB ${tmdbId}: ${error.message}`);
    return { imdbId: null, imdbRating: null, imdbVotes: null };
  }
};

/**
 * Writes/updates a normalized library item in users/{uid}/library_items.
 * Keeps library screen populated even while legacy collections still exist.
 */
export const upsertLibraryItemV2 = async (
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

  const inputImdbRating = firstNumber(
    mediaItem.imdbRating,
    mediaItem.imdb_rating,
    mediaItem?.rating?.aggregateRating,
    mediaItem?.rating?.ratingValue
  );
  const inputImdbVotes = firstNumber(
    mediaItem.imdbVotes,
    mediaItem.imdb_vote_count,
    mediaItem.imdbVotesCount,
    mediaItem?.rating?.voteCount,
    mediaItem?.rating?.ratingCount
  );

  let imdbId = mediaItem.imdbId || mediaItem.imdb_id || existingData.imdbId || null;
  let imdbRating = firstNumber(inputImdbRating, existingData.imdbRating, existingData.imdb_rating);
  let imdbVotes = firstNumber(inputImdbVotes, existingData.imdbVotes, existingData.imdb_vote_count);

  if (!imdbRating || !imdbVotes) {
    const fetchedImdb = await fetchImdbData(String(tmdbId), mediaType);
    imdbId = imdbId || fetchedImdb.imdbId || null;
    imdbRating = imdbRating || fetchedImdb.imdbRating || null;
    imdbVotes = imdbVotes || fetchedImdb.imdbVotes || null;
  }

  const mergedListIds = Array.isArray(existingData.listIds)
    ? [...existingData.listIds]
    : [];

  if (listId && !mergedListIds.includes(listId)) {
    mergedListIds.push(listId);
  }

  const voteAverage = firstNumber(
    mediaItem.vote_average,
    mediaItem.tmdb_rating,
    existingData.vote_average,
    existingData.tmdb_rating,
    existingData?.sort?.tmdbRating
  );

  const voteCount = firstNumber(
    mediaItem.vote_count,
    mediaItem.tmdb_vote_count,
    existingData.vote_count,
    existingData.tmdb_vote_count,
    existingData?.sort?.tmdbVotes
  );

  const resolvedStatus = status ?? existingData.status ?? null;
  const payload = {
    titleKey,
    mediaType,
    id: String(tmdbId),
    media_type: mediaType,
    title: mediaItem.title || mediaItem.name || existingData.title || existingData.name || "",
    name: mediaItem.name || mediaItem.title || existingData.name || existingData.title || "",
    poster_path: mediaItem.poster_path || existingData.poster_path || "",
    release_date:
      mediaItem.release_date ||
      mediaItem.first_air_date ||
      existingData.release_date ||
      existingData.first_air_date ||
      "",
    first_air_date:
      mediaItem.first_air_date ||
      mediaItem.release_date ||
      existingData.first_air_date ||
      existingData.release_date ||
      "",
    overview: mediaItem.overview || existingData.overview || "",
    vote_average: voteAverage ?? 0,
    vote_count: voteCount ?? 0,
    imdbId,
    imdbRating,
    imdbVotes,
    sort: {
      tmdbRating: voteAverage ?? 0,
      tmdbVotes: voteCount ?? 0,
      imdbRating: imdbRating ?? null,
      imdbVotes: imdbVotes ?? null,
      year:
        Number((mediaItem.release_date || mediaItem.first_air_date || "").slice(0, 4)) ||
        existingData?.sort?.year ||
        null,
    },
    status: resolvedStatus,
    listIds: mergedListIds,
    userRating: null,
    updatedAt: now,
    addedAt: existingData.addedAt || now,
    lastWatchedAt: null,
  };

  await setDoc(ref, payload, { merge: true });

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

  return {
    ...data,
    id: Number.isFinite(numericId) ? numericId : (data.id || titleKey),
    titleKey,
    media_type: mediaType === "tv" ? "tv" : "movie",
    title: resolvedTitle,
    name: data.name || data.title || data.display?.title || resolvedTitle,
    isFallbackTitle,
    poster_path: data.poster_path || data.display?.posterPath || "",
    release_date: data.release_date || data.display?.releaseDate || "",
    first_air_date: data.first_air_date || data.display?.releaseDate || "",
    vote_average:
      typeof data.vote_average === "number"
        ? data.vote_average
        : (typeof data.tmdb_rating === "number"
            ? data.tmdb_rating
            : (typeof data.sort?.tmdbRating === "number" ? data.sort.tmdbRating : 0)),
    vote_count:
      typeof data.vote_count === "number"
        ? data.vote_count
        : (typeof data.tmdb_vote_count === "number"
            ? data.tmdb_vote_count
            : (typeof data.sort?.tmdbVotes === "number" ? data.sort.tmdbVotes : 0)),
    imdbRating:
      typeof data.imdbRating === "number"
        ? data.imdbRating
        : (typeof data.imdb_rating === "number"
            ? data.imdb_rating
            : (typeof data.sort?.imdbRating === "number" ? data.sort.imdbRating : null)),
    imdbVotes:
      typeof data.imdbVotes === "number"
        ? data.imdbVotes
        : (typeof data.imdb_vote_count === "number"
            ? data.imdb_vote_count
            : (typeof data.sort?.imdbVotes === "number" ? data.sort.imdbVotes : null)),
    imdbId: data.imdbId || data.imdb_id || null,
    dateAdded: data.dateAdded || data.addedAt || data.updatedAt || null,
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

    // If this is a NEW document, fetch IMDb data ONCE
    if (!exists || !existingData.imdbRating) {
      console.log(`Fetching IMDb data for new library item: ${tmdbId}`);
      const imdbData = await fetchImdbData(tmdbId, mediaType);
      
      libraryItem.imdbRating = imdbData.imdbRating;
      libraryItem.imdbVotes = imdbData.imdbVotes;
      libraryItem.imdbId = imdbData.imdbId;
    } else {
      // Preserve existing IMDb data
      libraryItem.imdbRating = existingData.imdbRating;
      libraryItem.imdbVotes = existingData.imdbVotes;
      libraryItem.imdbId = existingData.imdbId;
    }

    // Preserve existing progress if any
    if (existingData.progress) {
      libraryItem.progress = existingData.progress;
    }

    // Save to Firestore
    await setDoc(itemRef, libraryItem, { merge: true });
    
    console.log(`✅ Library item updated: ${libraryItem.title} (Status: ${status})`);
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
    const tmdbId = String(mediaItem.id);
    const mediaType = mediaItem.media_type || (mediaItem.first_air_date ? "tv" : "movie");
    
    // Reference to the library document
    const itemRef = doc(db, "users", userId, "library", tmdbId);
    
    // Check if document exists
    const docSnapshot = await getDoc(itemRef);
    const exists = docSnapshot.exists();
    
    if (!exists) {
      // Document doesn't exist yet - create it with "passive" status
      console.log(`Creating passive library item for list tagging: ${tmdbId}`);
      
      const imdbData = await fetchImdbData(tmdbId, mediaType);
      
      const libraryItem = {
        id: tmdbId,
        media_type: mediaType,
        title: mediaItem.title || mediaItem.name || "",
        poster_path: mediaItem.poster_path || "",
        release_date: mediaItem.release_date || mediaItem.first_air_date || "",
        vote_average: mediaItem.vote_average || 0,
        vote_count: mediaItem.vote_count || 0,
        status: null, // Passive - only in custom lists
        dateAdded: new Date().toISOString(),
        listIds: add ? [listId] : [],
        imdbRating: imdbData.imdbRating,
        imdbVotes: imdbData.imdbVotes,
        imdbId: imdbData.imdbId,
      };
      
      await setDoc(itemRef, libraryItem);
      console.log(`✅ Created passive item and added to list: ${listId}`);
    } else {
      // Document exists - toggle the list ID
      const existingData = docSnapshot.data();
      const currentListIds = existingData.listIds || [];
      
      let updatedListIds;
      if (add) {
        // Add list ID if not already present
        if (!currentListIds.includes(listId)) {
          updatedListIds = [...currentListIds, listId];
          console.log(`✅ Added to list: ${listId}`);
        } else {
          console.log(`⚠️ Already in list: ${listId}`);
          return; // Already in list, no update needed
        }
      } else {
        // Remove list ID
        updatedListIds = currentListIds.filter(id => id !== listId);
        console.log(`✅ Removed from list: ${listId}`);
      }
      
      await setDoc(itemRef, { listIds: updatedListIds }, { merge: true });
    }
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
    const {
      pageSize = 50,
      cursor = null,
      sortBy = "updatedAt",
      sortDirection = "desc",
      includePageInfo = false,
      hydrate = true,
      allowLegacyFallback = true,
    } = options;

    const allowedSortFields = new Set([
      "updatedAt",
      "sort.imdbRating",
      "sort.year",
    ]);

    const normalizedSortBy = allowedSortFields.has(sortBy) ? sortBy : "updatedAt";
    const normalizedSortDirection = sortDirection === "asc" ? "asc" : "desc";
    const normalizedPageSize = Math.min(Math.max(Number(pageSize) || 50, 1), 100);

    const constraints = [
      where("status", "==", status),
      orderBy(normalizedSortBy, normalizedSortDirection),
      limit(normalizedPageSize + 1),
    ];

    if (cursor) {
      constraints.push(startAfter(cursor));
    }

    let querySnapshot;
    try {
      const libraryQuery = query(
        collection(db, "users", userId, "library_items"),
        ...constraints
      );
      querySnapshot = await getDocs(libraryQuery);
    } catch (primaryError) {
      if (!isIndexRelatedError(primaryError)) {
        throw primaryError;
      }

      // Index-safe fallback: keep server-side status filtering but drop custom ordering.
      const fallbackConstraints = [
        where("status", "==", status),
        orderBy(documentId()),
      ];

      // Important: preserve cursor-based pagination even in fallback mode.
      // Without this, callers that page until hasMore=false can repeatedly fetch the
      // first page and appear to "freeze" (especially on the Library screen).
      if (cursor) {
        fallbackConstraints.push(startAfter(cursor));
      }

      fallbackConstraints.push(limit(normalizedPageSize + 1));

      const fallbackQuery = query(
        collection(db, "users", userId, "library_items"),
        ...fallbackConstraints
      );
      querySnapshot = await getDocs(fallbackQuery);
    }

    const hasMore = querySnapshot.docs.length > normalizedPageSize;
    const pageDocs = hasMore
      ? querySnapshot.docs.slice(0, normalizedPageSize)
      : querySnapshot.docs;

    const items = pageDocs.map((d) => normalizeLibraryItem(d.id, d.data()));
    const nextCursor = hasMore ? pageDocs[pageDocs.length - 1] : null;

    let hydratedItems = items;
    if (hydrate) {
      try {
        const catalogHydrated = await hydrateItemsFromCatalog(items);
        hydratedItems = await hydrateItemsFromTmdb(catalogHydrated);
      } catch (hydrateError) {
        console.warn("Hydration skipped for getLibraryByStatus:", hydrateError?.message || hydrateError);
      }
    }

    if (includePageInfo) {
      return { items: hydratedItems, hasMore, nextCursor };
    }

    return hydratedItems;
  } catch (error) {
    console.error("Error getting library by status:", error);
    if (!options.allowLegacyFallback) {
      throw error;
    }
    // Legacy fallback for transition period
    try {
      const legacyQuery = query(
        collection(db, "users", userId, "library"),
        where("status", "==", status),
        limit(100)
      );
      const legacySnapshot = await getDocs(legacyQuery);
      const legacyItems = legacySnapshot.docs.map((d) => normalizeLibraryItem(d.id, d.data()));
      const catalogHydrated = await hydrateItemsFromCatalog(legacyItems);
      return hydrateItemsFromTmdb(catalogHydrated);
    } catch (legacyError) {
      console.error("Legacy fallback failed for getLibraryByStatus:", legacyError);
      throw error;
    }
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
    const {
      pageSize = 50,
      cursor = null,
      sortBy = "addedAt",
      sortDirection = "desc",
      includePageInfo = false,
      hydrate = true,
      allowLegacyFallback = true,
    } = options;

    const allowedSortFields = new Set([
      "addedAt",
      "sort.imdbRating",
      "position",
    ]);

    const normalizedSortBy = allowedSortFields.has(sortBy) ? sortBy : "addedAt";
    const defaultDirection = normalizedSortBy === "position" ? "asc" : "desc";
    const normalizedSortDirection = sortDirection === "asc" || sortDirection === "desc"
      ? sortDirection
      : defaultDirection;
    const normalizedPageSize = Math.min(Math.max(Number(pageSize) || 50, 1), 100);

    const constraints = [
      where("listIds", "array-contains", listId),
      orderBy(normalizedSortBy, normalizedSortDirection),
      limit(normalizedPageSize + 1),
    ];

    if (cursor) {
      constraints.push(startAfter(cursor));
    }

    let querySnapshot;
    try {
      const listItemsQuery = query(
        collection(db, "users", userId, "library_items"),
        ...constraints
      );
      querySnapshot = await getDocs(listItemsQuery);
    } catch (primaryError) {
      if (!isIndexRelatedError(primaryError)) {
        throw primaryError;
      }

      const fallbackConstraints = [
        where("listIds", "array-contains", listId),
        orderBy(documentId()),
      ];

      // Preserve cursor-based pagination in fallback mode.
      if (cursor) {
        fallbackConstraints.push(startAfter(cursor));
      }

      fallbackConstraints.push(limit(normalizedPageSize + 1));

      const fallbackQuery = query(
        collection(db, "users", userId, "library_items"),
        ...fallbackConstraints
      );
      querySnapshot = await getDocs(fallbackQuery);
    }

    const hasMore = querySnapshot.docs.length > normalizedPageSize;
    const pageDocs = hasMore
      ? querySnapshot.docs.slice(0, normalizedPageSize)
      : querySnapshot.docs;

    const items = pageDocs.map((d) => normalizeLibraryItem(d.id, d.data()));
    const nextCursor = hasMore ? pageDocs[pageDocs.length - 1] : null;

    let hydratedItems = items;
    if (hydrate) {
      try {
        const catalogHydrated = await hydrateItemsFromCatalog(items);
        hydratedItems = await hydrateItemsFromTmdb(catalogHydrated);
      } catch (hydrateError) {
        console.warn("Hydration skipped for getLibraryByListId:", hydrateError?.message || hydrateError);
      }
    }

    if (includePageInfo) {
      return { items: hydratedItems, hasMore, nextCursor };
    }

    return hydratedItems;
  } catch (error) {
    console.error("Error getting library by list ID:", error);
    if (!options.allowLegacyFallback) {
      throw error;
    }
    // Legacy fallback for transition period
    try {
      const legacyItemsQuery = query(
        collection(db, "users", userId, "custom_lists", listId, "items"),
        limit(100)
      );
      const legacySnapshot = await getDocs(legacyItemsQuery);
      const legacyItems = legacySnapshot.docs.map((d) => normalizeLibraryItem(d.id, d.data()));
      const catalogHydrated = await hydrateItemsFromCatalog(legacyItems);
      return hydrateItemsFromTmdb(catalogHydrated);
    } catch (legacyError) {
      console.error("Legacy fallback failed for getLibraryByListId:", legacyError);
      throw error;
    }
  }
};

// ============================================================================
// LEGACY FUNCTIONS (Keep for backward compatibility)
// ============================================================================

/**
 * Adds or updates a media item in a user's specific list in Firestore.
 * @param {string} userId - The UID of the user from Firebase Auth.
 * @param {string} listName - The name of the collection (e.g., "watchlist", "watched").
 * @param {object} mediaItem - The movie or TV show object to save.
 */
export const addToList = async (userId, listName, mediaItem) => {
  try {
    const mediaType =
      mediaItem.media_type || (mediaItem.first_air_date ? "tv" : "movie");

    // Reuse existing IMDb data first, fetch only if missing
    let imdbData = {
      imdbId: mediaItem.imdbId || mediaItem.imdb_id || null,
      imdbRating: firstNumber(
        mediaItem.imdbRating,
        mediaItem.imdb_rating,
        mediaItem?.rating?.aggregateRating,
        mediaItem?.rating?.ratingValue
      ),
      imdbVotes: firstNumber(
        mediaItem.imdbVotes,
        mediaItem.imdb_vote_count,
        mediaItem?.rating?.voteCount,
        mediaItem?.rating?.ratingCount
      ),
    };

    if (!imdbData.imdbRating || !imdbData.imdbVotes) {
      const fetchedImdb = await fetchImdbData(mediaItem.id, mediaType);
      imdbData = {
        imdbId: imdbData.imdbId || fetchedImdb.imdbId,
        imdbRating: imdbData.imdbRating || fetchedImdb.imdbRating,
        imdbVotes: imdbData.imdbVotes || fetchedImdb.imdbVotes,
      };
    }

    const itemToSave = {
      id: mediaItem.id,
      title: mediaItem.title || mediaItem.name,
      poster_path: mediaItem.poster_path,
      release_date: mediaItem.release_date || mediaItem.first_air_date,
      vote_average: mediaItem.vote_average,
      vote_count: mediaItem.vote_count,
      media_type: mediaType,
      dateAdded: new Date().toISOString(),
      imdbId: imdbData.imdbId,
      imdbRating: imdbData.imdbRating,
      imdbVotes: imdbData.imdbVotes,
    };
    const itemRef = doc(db, "users", userId, listName, String(mediaItem.id));
    await setDoc(itemRef, itemToSave);
    console.log(`Successfully added ${itemToSave.title} to ${listName}`);
  } catch (error) {
    console.error("Error adding document: ", error);
    throw error;
  }
};

/**
 * Fetches all items from a user's specific list in Firestore.
 * @param {string} userId - The UID of the user.
 * @param {string} listName - The name of the list (e.g., "watchlist").
 * @returns {Promise<Array>} - A promise that resolves to an array of media items.
 */
export const getList = async (userId, listName) => {
  try {
    const listCollectionRef = collection(
      db,
      "users",
      String(userId),
      String(listName)
    );
    const querySnapshot = await getDocs(listCollectionRef);
    try {
      const list = querySnapshot.docs.map((doc) => doc.data());
      return list;
    } catch (error) {
      console.error("Error parsing documents: ", error);
      return []; // Return empty list if parsing fails
    }
  } catch (error) {
    console.error("Error fetching list: ", error);
    throw error;
  }
};

/**
 * Removes a media item from a user's specific list in Firestore.
 * @param {string} userId - The UID of the user.
 * @param {string} listName - The name of the list (e.g., "watchlist").
 * @param {string|number} mediaId - The ID of the media item to remove.
 */
export const removeFromList = async (userId, listName, mediaId) => {
  try {
    const itemRef = doc(db, "users", userId, listName, String(mediaId));
    await deleteDoc(itemRef);
    console.log(`Successfully removed item ${mediaId} from ${listName}`);
  } catch (error) {
    console.error("Error removing document: ", error);
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
    const customListsRef = collection(db, "users", userId, "custom_lists");
    const newListData = {
      ...listData,
      createdAt: new Date(),
      ownerId: userId,
    };
    const docRef = await addDoc(customListsRef, newListData);
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
    // First, delete all items in the list's items subcollection
    const itemsCollectionRef = collection(
      db,
      "users",
      userId,
      "custom_lists",
      listId,
      "items"
    );
    const itemsSnapshot = await getDocs(itemsCollectionRef);

    const deletePromises = itemsSnapshot.docs.map((doc) => deleteDoc(doc.ref));
    await Promise.all(deletePromises);

    // Then, delete the list document itself
    const listRef = doc(db, "users", userId, "custom_lists", listId);
    await deleteDoc(listRef);
    console.log(`Successfully deleted custom list with ID: ${listId}`);
  } catch (error) {
    console.error("Error deleting custom list: ", error);
    throw error;
  }
};

/**
 * Adds an item to a custom list in Firestore.
 * @param {string} userId - The UID of the user from Firebase Auth.
 * @param {string} listId - The ID of the list to add the item to.
 * @param {Object} mediaItem - The media item to add to the list.
 */
export const addItemToCustomList = async (userId, listId, mediaItem) => {
  try {
    const mediaType =
      mediaItem.media_type || (mediaItem.first_air_date ? "tv" : "movie");

    // Reuse existing IMDb data first, fetch only when missing
    let imdbData = { imdbId: null, imdbRating: null, imdbVotes: null };
    if (mediaType !== "episode") {
      imdbData = {
        imdbId: mediaItem.imdbId || mediaItem.imdb_id || null,
        imdbRating: firstNumber(
          mediaItem.imdbRating,
          mediaItem.imdb_rating,
          mediaItem?.rating?.aggregateRating,
          mediaItem?.rating?.ratingValue
        ),
        imdbVotes: firstNumber(
          mediaItem.imdbVotes,
          mediaItem.imdb_vote_count,
          mediaItem?.rating?.voteCount,
          mediaItem?.rating?.ratingCount
        ),
      };

      if (!imdbData.imdbRating || !imdbData.imdbVotes) {
        const fetchedImdb = await fetchImdbData(mediaItem.id, mediaType);
        imdbData = {
          imdbId: imdbData.imdbId || fetchedImdb.imdbId,
          imdbRating: imdbData.imdbRating || fetchedImdb.imdbRating,
          imdbVotes: imdbData.imdbVotes || fetchedImdb.imdbVotes,
        };
      }
    }

    const itemToSave = {
      id: mediaItem.id,
      title: mediaItem.title || mediaItem.name,
      poster_path: mediaItem.poster_path,
      release_date: mediaItem.release_date || mediaItem.first_air_date || "",
      vote_average: mediaItem.vote_average || 0,
      vote_count: mediaItem.vote_count || 0,
      media_type: mediaType,
      dateAdded: new Date(),
      imdbId: imdbData.imdbId,
      imdbRating: imdbData.imdbRating,
      imdbVotes: imdbData.imdbVotes,
      // Preserve episode-specific fields
      ...(mediaType === "episode" && {
        showId: mediaItem.showId,
        showTitle: mediaItem.showTitle,
        seasonNumber: mediaItem.seasonNumber,
        episodeNumber: mediaItem.episodeNumber,
        episodeTitle: mediaItem.episodeTitle,
        backdrop_path: mediaItem.backdrop_path,
        overview: mediaItem.overview,
      }),
    };
    
    const itemsCollectionRef = collection(
      db,
      "users",
      userId,
      "custom_lists",
      listId,
      "items"
    );
    const itemRef = doc(itemsCollectionRef, String(mediaItem.id));
    await setDoc(itemRef, itemToSave);
    console.log(
      `Successfully added ${itemToSave.title} to custom list ${listId}`
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
    const itemsCollectionRef = collection(
      db,
      "users",
      userId,
      "custom_lists",
      listId,
      "items"
    );

    // Process items in chunks of 500 (Firestore batch limit)
    const chunkSize = 450; // Safety margin
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const currentBatch = writeBatch(db);

      const promises = chunk.map(async (mediaItem) => {
        const mediaType =
          mediaItem.media_type || (mediaItem.first_air_date ? "tv" : "movie");

        // Note: Fetching IMDB data for each item might be slow/rate-limited.
        // For batch operations, we might skip IMDB data or fetch it lazily later.
        // For now, we'll skip IMDB fetch to ensure speed and avoid timeouts.

        const itemToSave = {
          // === IDs ===
          id: String(mediaItem.id),
          tmdbId: mediaItem.tmdbId || null,
          simklId: mediaItem.simklId || null,
          imdbId: mediaItem.imdbId || null,
          tvdbId: mediaItem.tvdbId || null,
          malId: mediaItem.malId || null,
          anilistId: mediaItem.anilistId || null,
          anidbId: mediaItem.anidbId || null,
          
          // === Basic Info ===
          title: mediaItem.title || mediaItem.name || "",
          year: mediaItem.year || null,
          poster_path: mediaItem.poster_path || null,
          release_date: mediaItem.release_date || mediaItem.first_air_date || null,
          first_air_date: mediaItem.first_air_date || null,
          media_type: mediaType,
          runtime: mediaItem.runtime || null,
          
          // === User Data ===
          status: mediaItem.status || null,
          watchedAt: mediaItem.watchedAt || null,
          addedToWatchlistAt: mediaItem.addedToWatchlistAt || null,
          user_rating: mediaItem.user_rating || null,
          watchedEpisodesCount: mediaItem.watchedEpisodesCount || 0,
          totalEpisodesCount: mediaItem.totalEpisodesCount || 0,
          notAiredEpisodesCount: mediaItem.notAiredEpisodesCount || 0,
          nextToWatch: mediaItem.nextToWatch || null,
          lastWatched: mediaItem.lastWatched || null,
          animeType: mediaItem.animeType || null,
          
          // === Ratings (placeholders - filled by enrichment) ===
          vote_average: mediaItem.vote_average || 0,
          vote_count: mediaItem.vote_count || 0,
          tmdb_rating: mediaItem.tmdb_rating || null,
          tmdb_vote_count: mediaItem.tmdb_vote_count || null,
          imdb_rating: mediaItem.imdb_rating || null,
          imdb_vote_count: mediaItem.imdb_vote_count || null,
          
          // === Metadata (placeholders - filled by enrichment) ===
          overview: mediaItem.overview || null,
          backdrop_path: mediaItem.backdrop_path || null,
          
          // === Tracking ===
          dateAdded: new Date(),
          enrichmentStatus: mediaItem.enrichmentStatus || "pending",
          lastEnriched: mediaItem.lastEnriched || null,
        };

        // Remove undefined fields just in case
        Object.keys(itemToSave).forEach(
          (key) => itemToSave[key] === undefined && delete itemToSave[key]
        );

        const itemRef = doc(itemsCollectionRef, String(mediaItem.id));
        currentBatch.set(itemRef, itemToSave);
      });

      await Promise.all(promises);
      await currentBatch.commit();
      console.log(`Successfully committed batch of ${chunk.length} items`);
    }

    console.log(
      `Successfully added ${items.length} items to custom list ${listId}`
    );
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
    const itemRef = doc(
      db,
      "users",
      userId,
      "custom_lists",
      listId,
      "items",
      String(mediaId)
    );
    await deleteDoc(itemRef);
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
    const customListsCollectionRef = collection(
      db,
      "users",
      String(userId),
      "custom_lists"
    );
    const querySnapshot = await getDocs(customListsCollectionRef);
    try {
      const lists = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      return lists;
    } catch (error) {
      console.error("Error parsing custom lists: ", error);
      return []; // Return empty list if parsing fails
    }
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
    const listsWithPreviews = await Promise.all(
      lists.map(async (list) => {
        // Fetch only the first 10 items for preview
        const itemsCollectionRef = collection(
          db,
          "users",
          userId,
          "custom_lists",
          list.id,
          "items"
        );
        const itemsQuery = query(itemsCollectionRef, limit(10));
        const itemsSnapshot = await getDocs(itemsQuery);

        const items = itemsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        return {
          ...list,
          items: items,
        };
      })
    );
    return listsWithPreviews;
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
    // Fetch the list document
    const listRef = doc(db, "users", userId, "custom_lists", listId);
    const listSnap = await getDoc(listRef);

    if (!listSnap.exists()) {
      throw new Error(
        `List with ID ${listId} does not exist for user ${userId}`
      );
    }

    const listData = {
      id: listSnap.id,
      ...listSnap.data(),
    };

    // Fetch all items in the list
    const itemsCollectionRef = collection(
      db,
      "users",
      userId,
      "custom_lists",
      listId,
      "items"
    );
    const itemsSnapshot = await getDocs(itemsCollectionRef);

    const items = itemsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return {
      ...listData,
      items: items,
    };
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
    const listRef = doc(db, "users", userId, "custom_lists", listId);
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
    const listRef = doc(db, "users", userId, "custom_lists", listId);
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
    const customListsRef = collection(db, "users", userId, "custom_lists");
    const newListData = {
      name: "Watch Later",
      description: "Your default watch later list",
      createdAt: new Date(),
      ownerId: userId,
      isPinned: true,
      pinnedAt: new Date(),
    };
    const docRef = await addDoc(customListsRef, newListData);
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
  listId,
  itemId,
  enrichedData
) => {
  try {
    const itemRef = doc(
      db,
      "users",
      userId,
      "custom_lists",
      listId,
      "items",
      String(itemId)
    );
    await setDoc(
      itemRef,
      {
        ...enrichedData,
        enrichmentStatus: "complete",
        lastEnriched: new Date().toISOString(),
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
    const itemsCollectionRef = collection(
      db,
      "users",
      userId,
      "custom_lists",
      listId,
      "items"
    );

    // Note: This query requires an index on enrichmentStatus.
    // If index is missing, it might fail. For now, we might just fetch latest added.
    // Ideally: where("enrichmentStatus", "==", "pending")

    const q = query(
      itemsCollectionRef,
      // where("enrichmentStatus", "==", "pending"), // Commented out to avoid index error for now
      limit(50) // Fetch 50, filter in memory if needed
    );

    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((item) => item.enrichmentStatus === "pending")
      .slice(0, limitCount);
  } catch (error) {
    console.error("Error fetching pending items:", error);
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

  const legacyLibraryRef = collection(db, "users", userId, "library");
  const legacyLibrarySnap = await getDocs(legacyLibraryRef);
  legacyLibrarySnap.docs.forEach((snap) => {
    targets.push({
      docRef: snap.ref,
      docId: snap.id,
      source: "library",
      ...snap.data(),
    });
  });

  const customListsRef = collection(db, "users", userId, "custom_lists");
  const customListsSnap = await getDocs(customListsRef);
  for (const listDoc of customListsSnap.docs) {
    const itemsRef = collection(db, "users", userId, "custom_lists", listDoc.id, "items");
    const itemsSnap = await getDocs(itemsRef);
    itemsSnap.docs.forEach((snap) => {
      targets.push({
        docRef: snap.ref,
        docId: snap.id,
        source: "custom_list_items",
        listId: listDoc.id,
        ...snap.data(),
      });
    });
  }

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

    console.log(`🔄 Starting metadata refresh for ${itemsToRefresh.length} items (batch size: ${batchSize})`);

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
          console.log(`✅ Refreshed: ${item.title || item.name || item.docId} (${item.source})`);
        } else {
          console.warn(`⚠️ No metadata found for: ${item.title || item.name || item.docId}`);
        }
      } catch (error) {
        summary.failed++;
        summary.errors.push({
          itemId: item.id || item.docId,
          title: item.title || item.name || item.docId,
          source: item.source,
          error: error.message,
        });
        console.error(`❌ Failed to refresh ${item.title || item.name || item.docId}:`, error.message);
      }

      // Small delay to prevent overwhelming the API
      if (i < itemsToRefresh.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    summary.endTime = new Date();
    summary.duration = summary.endTime - summary.startTime;

    console.log(`✅ Metadata refresh complete:`, summary);
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

    console.log(`🔄 Refreshing metadata for custom list "${listId}" (${itemsToRefresh.length} items)`);

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
          console.log(`✅ Refreshed: ${item.title}`);
        }
      } catch (error) {
        summary.failed++;
        summary.errors.push({
          itemId: item.id,
          title: item.title,
          error: error.message,
        });
        console.error(`❌ Failed: ${item.title}`);
      }

      // Delay between requests
      if (i < itemsToRefresh.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    summary.endTime = new Date();
    summary.duration = summary.endTime - summary.startTime;

    console.log(`✅ Custom list refresh complete:`, summary);
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

