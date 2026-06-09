import { doc, getDoc } from 'firebase/firestore';
import { db } from '../util/firebase/firebase';
import { firstNumber } from '../util/firebase/firestoreService';
import tmdbApiService from './tmdb/tmdbApiService';

export const normalizeLibraryItem = (docId, data = {}) => {
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

export const hydrateItemsFromCatalog = async (items) => {
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

export const hydrateItemsFromTmdb = async (items) => {
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
        const data = await tmdbApiService.get(`/${mediaType}/${id}`, { language: 'en-US' });
        if (!data) return;
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
