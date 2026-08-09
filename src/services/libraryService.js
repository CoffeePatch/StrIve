import { auth } from '../util/firebase/firebase';
import { hydrateItemsFromCatalog, hydrateItemsFromTmdb } from './tmdbHydrationService';
import { normalizeWatchStatus } from '../util/library/watchStatus';

export {
  normalizeLibraryItem,
  hydrateItemsFromCatalog,
  hydrateItemsFromTmdb
} from './tmdbHydrationService';

/**
 * Maps a Prisma user_library_item (with catalogTitle joined) to the Firestore legacy shape.
 */
export const mapPrismaToLibraryItem = (prismaItem) => {
  const c = prismaItem.catalogTitle || {};
  const mediaType = c.mediaType || (prismaItem.titleKey.includes('_tv_') ? 'tv' : 'movie');
  const numericId = Number(prismaItem.titleKey.replace(/^tmdb_(movie|tv)_/, ''));

  return {
    id: numericId,
    titleKey: prismaItem.titleKey,
    media_type: mediaType,
    mediaType: mediaType,
    tmdbId: c.tmdbId,
    imdbId: c.imdbId,
    title: c.title,
    name: c.title,
    isFallbackTitle: !c.title,
    poster_path: c.posterPath,
    backdrop_path: c.backdropPath,
    release_date: c.releaseDate || c.firstAirDate,
    first_air_date: c.firstAirDate,
    vote_average: Number(c.tmdbScore || 0),
    vote_count: c.tmdbVotes || 0,
    imdbRating: Number(c.imdbScore || 0),
    imdbVotes: c.imdbVotes || null,
    ratings: {
      tmdbScore: Number(c.tmdbScore || 0),
      tmdbVotes: c.tmdbVotes || 0,
      imdbScore: Number(c.imdbScore || 0),
      imdbVotes: c.imdbVotes || null,
    },
    genres: c.genres || [],
    dateAdded: prismaItem.addedAt,
    userRating: prismaItem.userRating ? Number(prismaItem.userRating) : null,
    userNotes: prismaItem.notes || null,
    tracking: {
      watchStatus: prismaItem.status,
      userRating: prismaItem.userRating ? Number(prismaItem.userRating) : null,
      userNotes: prismaItem.notes || null,
      addedAt: prismaItem.addedAt,
      updatedAt: prismaItem.addedAt,
      lastWatchedAt: prismaItem.lastWatchedAt,
      listIds: [],
    },
  };
};

/**
 * Gets all library items
 */
export const getAllLibraryItems = async (userId, options = {}) => {
  try {
    const { sortBy = "updatedAt", sortDirection = "desc", includePageInfo = false, hydrate = true } = options;

    const user = auth.currentUser;
    if (!user) throw new Error("unauthenticated");
    const token = await user.getIdToken();

    // Fetch from BFF with a large limit to preserve client-side aggregation/sorting (transitional limitation)
    const response = await fetch(`/api/library?limit=10000`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    
    // Map Prisma flat objects to expected nested shape
    const items = (Array.isArray(data.items) ? data.items : []).map(mapPrismaToLibraryItem);

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

    if (!targetStatus) {
      return includePageInfo ? { items: [], hasMore: false, nextCursor: null } : [];
    }

    const user = auth.currentUser;
    if (!user) throw new Error("unauthenticated");
    const token = await user.getIdToken();

    // Fetch from BFF. If frontend limit is given, pass it, otherwise use 10000 for aggregation.
    const queryLimit = limitCount || 10000;
    const response = await fetch(`/api/library?status=${targetStatus}&limit=${queryLimit}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();

    const items = (Array.isArray(data.items) ? data.items : []).map(mapPrismaToLibraryItem);

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
 * Gets continue watching items proxying the new endpoint
 */
export const getContinueWatching = async (userId, options = {}) => {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error("unauthenticated");
    const token = await user.getIdToken();

    const response = await fetch(`/api/library/continue-watching?limit=${options.limit || 20}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    return (Array.isArray(data.items) ? data.items : []).map(mapPrismaToLibraryItem);
  } catch (error) {
    console.error("Error getting continue watching items:", error);
    throw error;
  }
};