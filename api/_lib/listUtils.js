import { db } from "./firebaseAdmin.js";
import { fetchWithTimeout } from "./utils.js";

export class HttpRequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = "HttpRequestError";
  }
}

function normalizeListId(listId) {
  return listId === "watchlist" ? "watchlist" : String(listId || "").trim();
}

function getUserListRef(uid, listId) {
  return db.collection("users").doc(uid).collection("lists").doc(listId);
}

function getLibraryItemsRef(uid) {
  return db.collection("users").doc(uid).collection("library_items");
}

function createListItemsAccessor(uid, listId) {
  const normalizedListId = normalizeListId(listId);
  const collectionRef = getLibraryItemsRef(uid);
  const queryRef = collectionRef.where(
    "tracking.listIds",
    "array-contains",
    normalizedListId,
  );

  return {
    collectionRef,
    queryRef,
    listId: normalizedListId,
    get: () => queryRef.get(),
    doc: (docId) => collectionRef.doc(String(docId)),
  };
}

export async function resolveAuthorizedCustomList(uid, listId) {
  const listRef = getUserListRef(uid, listId);

  const listDoc = await listRef.get();
  if (!listDoc.exists) {
    throw new HttpRequestError(404, "List not found");
  }

  const listData = listDoc.data() || {};
  if (!listData.ownerId || listData.ownerId !== uid) {
    throw new HttpRequestError(
      403,
      "Forbidden: You do not have permission to access this list",
    );
  }

  return { listRef, listData };
}

export async function resolveListExportContext(uid, listId) {
  const normalizedListId = normalizeListId(listId);
  if (normalizedListId === "watchlist") {
    return {
      itemsCollectionRef: createListItemsAccessor(uid, normalizedListId),
      listName: "Watchlist",
    };
  }

  const { listData } = await resolveAuthorizedCustomList(uid, normalizedListId);
  const itemsCollectionRef = createListItemsAccessor(uid, normalizedListId);

  const listName =
    typeof listData.name === "string" && listData.name.trim()
      ? listData.name.trim()
      : normalizedListId;
  return {
    itemsCollectionRef,
    listName,
  };
}

export async function resolveListItemsCollection(uid, listId) {
  const normalizedListId = normalizeListId(listId);
  if (normalizedListId !== "watchlist") {
    await resolveAuthorizedCustomList(uid, normalizedListId);
  }

  return createListItemsAccessor(uid, normalizedListId);
}

export async function fetchTmdbExternalIds(mediaType, tmdbId, tmdbToken) {
  if (!tmdbToken) return null;
  const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids`;
  try {
    const res = await fetchWithTimeout(
      url,
      { headers: { Authorization: `Bearer ${tmdbToken}` } },
      8000,
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function fetchTmdbDetails(mediaType, tmdbId, tmdbToken) {
  if (!tmdbToken) return null;
  const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}`;
  try {
    const res = await fetchWithTimeout(
      url,
      { headers: { Authorization: `Bearer ${tmdbToken}` } },
      8000,
    );
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export function getImdbApiBaseUrl() {
  const baseUrl = process.env.IMDB_API_BASE_URL || process.env.VITE_IMDB_BASE_URL;
  if (!baseUrl) {
    console.warn(
      "IMDb API base URL environment variable is not configured. IMDb ratings will be unavailable.",
    );
    return null;
  }
  return baseUrl.replace(/\/$/, "");
}

export async function fetchImdbRatings(imdbId) {
  if (!imdbId) return null;
  try {
    const base = getImdbApiBaseUrl();
    if (!base) return null;

    const url = `${base}/titles/${imdbId}`;
    const res = await fetchWithTimeout(url, {}, 8000);
    if (!res.ok) return null;
    const data = await res.json();
    const rating = data?.rating ?? data?.ratings?.imdb ?? data?.ratingAverage;
    const votes = data?.votes ?? data?.ratingsCount ?? data?.imdbVotes;
    return {
      rating:
        typeof rating === "number"
          ? rating
          : typeof rating === "string"
            ? parseFloat(rating)
            : undefined,
      votes:
        typeof votes === "number"
          ? votes
          : typeof votes === "string"
            ? parseInt(votes.replace(/[,]/g, ""), 10)
            : undefined,
    };
  } catch (err) {
    console.error(`fetchImdbRatings error for ${imdbId}:`, err);
    return null;
  }
}

function deriveMediaType(item) {
  if (item?.mediaType === "tv" || item?.media_type === "tv") return "tv";
  if (item?.mediaType === "movie" || item?.media_type === "movie") return "movie";
  if (item?.first_air_date || item?.firstAirDate) return "tv";
  return "movie";
}

function deriveName(item, mediaType) {
  return mediaType === "movie"
    ? item?.title || item?.name || ""
    : item?.name || item?.title || "";
}

function deriveYear(item, mediaType) {
  const dateStr =
    mediaType === "movie"
      ? item?.releaseDate || item?.release_date || item?.first_air_date
      : item?.first_air_date || item?.releaseDate || item?.release_date;
  if (!dateStr) return "";
  const d = new Date(dateStr?.toDate ? dateStr.toDate() : dateStr);
  return isNaN(d.getTime()) ? "" : String(d.getUTCFullYear());
}

export async function enrichItem(item, tmdbToken) {
  const tmdbId = item?.tmdbId ?? item?.id ?? item?.tmdb_id;
  const mediaType = deriveMediaType(item);
  const name = deriveName(item, mediaType);
  const year = deriveYear(item, mediaType);

  let imdbId = "";
  let tmdbRating = "";
  let tmdbVotes = "";
  let imdbRating = "";
  let imdbVotes = "";

  const [ext, details] = await Promise.all([
    fetchTmdbExternalIds(mediaType, tmdbId, tmdbToken),
    fetchTmdbDetails(mediaType, tmdbId, tmdbToken),
  ]);

  if (ext?.imdb_id) imdbId = ext.imdb_id;

  if (details) {
    const va = details.vote_average;
    const vc = details.vote_count;
    if (typeof va === "number")
      tmdbRating = va.toFixed(1).replace(/\.0$/, ".0");
    if (typeof vc === "number") tmdbVotes = String(vc);
  }

  if (!tmdbRating && typeof item?.vote_average === "number") {
    tmdbRating = item.vote_average.toFixed(1).replace(/\.0$/, ".0");
  }
  if (!tmdbVotes && typeof item?.vote_count === "number") {
    tmdbVotes = String(item.vote_count);
  }

  if (imdbId) {
    const imdb = await fetchImdbRatings(imdbId);
    if (imdb) {
      if (typeof imdb.rating === "number")
        imdbRating = imdb.rating.toFixed(1).replace(/\.0$/, ".0");
      if (typeof imdb.votes === "number") imdbVotes = String(imdb.votes);
    }
  }

  return {
    tmdbId,
    imdbId,
    name,
    year,
    mediaType,
    tmdbRating,
    imdbRating,
    tmdbVotes,
    imdbVotes,
  };
}
