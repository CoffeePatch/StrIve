import { doc, setDoc, deleteField } from 'firebase/firestore';
import { db } from '../util/firebase/firebase';
import { firstNumber } from '../util/firebase/firestoreService';
import { CACHE_KEYS, TTL, sessionCache, invalidateContinueWatching } from '../util/cache/sessionCache';
import { invalidateLibraryPipelineCache } from '../hooks/library/libraryPipelineCache';
import { getImdbId } from '../util/imdb/imdbResolver';
import IMDbService from '../util/imdb/imdbService';
import tmdbApiService from './tmdb/tmdbApiService';

const inFlightRequests = new Map();
const listeners = new Set();

const isPositiveNumber = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0;

const getRequestKey = ({ titleKey, tmdbId, mediaType }) => {
  if (titleKey) return `metadata_${titleKey}`;
  return `metadata_${mediaType}_${tmdbId}`;
};

const getTmdbCacheKey = (tmdbId, mediaType) => `metadata_tmdb_${mediaType}_${tmdbId}`;

const getDocRef = (userId, titleKey) => {
  if (!userId || !titleKey) return null;
  return doc(db, 'users', userId, 'library_items', titleKey);
};

export const deriveMetadataContext = (item = {}, docId = '') => {
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

  return {
    titleKey: item.titleKey || (mediaType && tmdbId ? `tmdb_${mediaType}_${tmdbId}` : docId || null),
    tmdbId: tmdbId && Number.isFinite(tmdbId) ? String(Math.trunc(tmdbId)) : null,
    mediaType: mediaType === 'tv' ? 'tv' : 'movie',
  };
};

export const needsMetadataRefresh = (item = {}, forceRefresh = false) => {
  if (forceRefresh) return true;

  const imdbRating = firstNumber(item.imdbRating, item.imdb_rating, item?.ratings?.imdbScore);
  const imdbVotes = firstNumber(item.imdbVotes, item.imdb_vote_count, item?.ratings?.imdbVotes);
  const voteCount = firstNumber(item.vote_count, item.tmdb_vote_count, item?.sort?.tmdbVotes, item?.ratings?.tmdbVotes);

  return !isPositiveNumber(imdbRating) || !isPositiveNumber(imdbVotes) || !isPositiveNumber(voteCount) || !(item.imdbId || item.imdb_id);
};

const extractImdbSnapshot = (imdbTitle = {}) => ({
  imdbId: imdbTitle?.id || null,
  imdbRating: firstNumber(
    imdbTitle?.rating?.aggregateRating,
    imdbTitle?.rating?.ratingValue,
    imdbTitle?.aggregateRating,
    imdbTitle?.imdbRating
  ),
  imdbVotes: firstNumber(
    imdbTitle?.rating?.voteCount,
    imdbTitle?.rating?.ratingCount,
    imdbTitle?.voteCount,
    imdbTitle?.imdbVotes
  ),
  imdbPoster: imdbTitle?.primaryImage?.url || null,
});

const extractTmdbSnapshot = (tmdbData = {}) => ({
  voteAverage: firstNumber(tmdbData?.vote_average),
  voteCount: firstNumber(tmdbData?.vote_count),
  overview: tmdbData?.overview || null,
  backdropPath: tmdbData?.backdrop_path || null,
  posterPath: tmdbData?.poster_path || null,
});

const fetchImdbTitle = async (imdbId, forceRefresh = false) => {
  if (!imdbId) return null;
  const cacheKey = CACHE_KEYS.IMDB_TITLE(imdbId);

  if (!forceRefresh) {
    const cached = sessionCache.get(cacheKey);
    if (cached) return cached;
  }

  const imdbService = new IMDbService();
  const titleData = await imdbService.getTitleById(imdbId);
  sessionCache.set(cacheKey, titleData, TTL.IMDB_TITLE);
  return titleData;
};

const fetchTmdbDetails = async (tmdbId, mediaType, forceRefresh = false) => {
  if (!tmdbId) return null;
  const cacheKey = getTmdbCacheKey(tmdbId, mediaType);

  if (!forceRefresh) {
    const cached = sessionCache.get(cacheKey);
    if (cached) return cached;
  }

  const data = await tmdbApiService.get(`/${mediaType}/${tmdbId}`, { language: 'en-US' });
  sessionCache.set(cacheKey, data, mediaType === 'tv' ? TTL.TV_DETAILS : TTL.MOVIE_DETAILS);
  return data;
};

export const resolveMetadataSnapshot = async ({
  tmdbId,
  mediaType,
  prefetchedImdbId = null,
  forceRefresh = false,
} = {}) => {
  if (!tmdbId) {
    return {
      tmdbId: null,
      mediaType: mediaType === 'tv' ? 'tv' : 'movie',
      hasData: false,
    };
  }

  let imdbId = prefetchedImdbId ? String(prefetchedImdbId) : null;
  if (!imdbId) {
    try {
      imdbId = await getImdbId(String(tmdbId), mediaType === 'tv' ? 'tv' : 'movie');
    } catch (error) {
      console.debug('Failed to resolve IMDb ID in metadata coordinator:', error?.message || error);
    }
  }

  const [imdbTitle, tmdbData] = await Promise.all([
    imdbId ? fetchImdbTitle(imdbId, forceRefresh) : Promise.resolve(null),
    fetchTmdbDetails(tmdbId, mediaType, forceRefresh),
  ]);

  const imdbSnapshot = extractImdbSnapshot(imdbTitle || {});
  const tmdbSnapshot = extractTmdbSnapshot(tmdbData || {});

  return {
    tmdbId: String(tmdbId),
    mediaType: mediaType === 'tv' ? 'tv' : 'movie',
    imdbId: imdbSnapshot.imdbId || imdbId || null,
    imdbTitle,
    imdbRating: imdbSnapshot.imdbRating,
    imdbVotes: imdbSnapshot.imdbVotes,
    imdbPoster: imdbSnapshot.imdbPoster,
    voteAverage: tmdbSnapshot.voteAverage,
    voteCount: tmdbSnapshot.voteCount,
    overview: tmdbSnapshot.overview,
    backdropPath: tmdbSnapshot.backdropPath,
    posterPath: tmdbSnapshot.posterPath,
    hasData: Boolean(
      imdbSnapshot.imdbId ||
      isPositiveNumber(imdbSnapshot.imdbRating) ||
      isPositiveNumber(imdbSnapshot.imdbVotes) ||
      isPositiveNumber(tmdbSnapshot.voteAverage) ||
      isPositiveNumber(tmdbSnapshot.voteCount) ||
      tmdbSnapshot.overview ||
      tmdbSnapshot.backdropPath ||
      tmdbSnapshot.posterPath
    ),
  };
};

const currentRatingValue = (item = {}) => ({
  imdbId: item.imdbId || item.imdb_id || null,
  imdbRating: firstNumber(item.imdbRating, item.imdb_rating, item?.ratings?.imdbScore),
  imdbVotes: firstNumber(item.imdbVotes, item.imdb_vote_count, item?.ratings?.imdbVotes),
  tmdbScore: firstNumber(item.vote_average, item.tmdb_rating, item?.ratings?.tmdbScore),
  tmdbVotes: firstNumber(item.vote_count, item.tmdb_vote_count, item?.sort?.tmdbVotes, item?.ratings?.tmdbVotes),
  imdbPoster: item?.images?.imdbPoster || item.imdbPoster || null,
  overview: item.overview || null,
  backdropPath: item.backdrop_path || item.backdropPath || null,
});

const setIfChanged = (patch, key, nextValue, currentValue) => {
  if (nextValue === undefined) return;
  if (nextValue === currentValue) return;
  patch[key] = nextValue;
};

export const buildMetadataPatch = (currentItem = {}, snapshot = {}, { forceRefresh = false, trackStatus = false } = {}) => {
  const patch = {};
  const current = currentRatingValue(currentItem);

  setIfChanged(patch, 'imdbId', snapshot.imdbId || current.imdbId || null, current.imdbId);
  setIfChanged(patch, 'overview', snapshot.overview || current.overview || null, current.overview);
  setIfChanged(patch, 'backdrop_path', snapshot.backdropPath || current.backdropPath || null, current.backdropPath);

  if (snapshot.imdbPoster && snapshot.imdbPoster !== current.imdbPoster) {
    patch.images = {
      ...(currentItem?.images || {}),
      imdbPoster: snapshot.imdbPoster,
    };
  }

  const ratings = {};
  if (snapshot.imdbRating !== undefined && snapshot.imdbRating !== current.imdbRating) {
    ratings.imdbScore = snapshot.imdbRating ?? null;
  }
  if (snapshot.imdbVotes !== undefined && snapshot.imdbVotes !== current.imdbVotes) {
    ratings.imdbVotes = snapshot.imdbVotes ?? null;
  }
  if (snapshot.voteAverage !== undefined && snapshot.voteAverage !== current.tmdbScore) {
    ratings.tmdbScore = snapshot.voteAverage ?? 0;
  }
  if (snapshot.voteCount !== undefined && snapshot.voteCount !== current.tmdbVotes) {
    ratings.tmdbVotes = snapshot.voteCount ?? 0;
  }
  if (Object.keys(ratings).length > 0) {
    patch.ratings = ratings;
  }

  const flatFieldPresence = [
    currentItem.imdbRating,
    currentItem.imdbVotes,
    currentItem.imdb_rating,
    currentItem.imdb_vote_count,
    currentItem.vote_average,
    currentItem.vote_count,
    currentItem.tmdb_rating,
    currentItem.tmdb_vote_count,
    currentItem?.sort?.imdbRating,
    currentItem?.sort?.imdbVotes,
    currentItem?.sort?.tmdbRating,
    currentItem?.sort?.tmdbVotes,
  ].some((value) => value !== undefined && value !== null);

  const hasRatingUpdates = Object.keys(ratings).length > 0 || snapshot.imdbId !== undefined || snapshot.imdbPoster || snapshot.overview || snapshot.backdropPath;

  if (hasRatingUpdates && flatFieldPresence) {
    patch.imdbRating = deleteField();
    patch.imdbVotes = deleteField();
    patch.imdb_rating = deleteField();
    patch.imdb_vote_count = deleteField();
    patch.vote_average = deleteField();
    patch.vote_count = deleteField();
    patch.tmdb_rating = deleteField();
    patch.tmdb_vote_count = deleteField();
    patch.sort = {
      imdbRating: deleteField(),
      imdbVotes: deleteField(),
      tmdbRating: deleteField(),
      tmdbVotes: deleteField(),
    };
  }

  if (trackStatus) {
    patch.enrichmentStatus = 'enriched';
    patch.lastEnriched = new Date().toISOString();
    patch.nextEnrichmentAttempt = null;
  }

  if (forceRefresh) {
    patch.lastMetadataRefresh = new Date().toISOString();
  }

  return Object.keys(patch).length > 0 ? patch : null;
};

export const subscribeMetadataUpdates = (listener) => {
  if (typeof listener !== 'function') return () => {};
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const notifyMetadataUpdates = (payload) => {
  listeners.forEach((listener) => {
    try {
      listener(payload);
    } catch (error) {
      console.warn('Metadata update listener failed:', error?.message || error);
    }
  });
};

export const requestMetadataEnrichment = async ({
  item = {},
  docRef = null,
  userId = null,
  titleKey = null,
  existingData = null,
  forceRefresh = false,
  persist = true,
  trackStatus = false,
  prefetchedImdbId = null,
} = {}) => {
  const context = deriveMetadataContext({ ...item, titleKey }, item.docId || titleKey || '');
  if (!context.tmdbId) {
    return {
      ...context,
      changed: false,
      hasData: false,
      reason: 'missing-tmdb-id',
    };
  }

  const requestKey = getRequestKey(context);
  if (inFlightRequests.has(requestKey)) {
    return inFlightRequests.get(requestKey);
  }

  const requestPromise = (async () => {
    try {
      const snapshot = await resolveMetadataSnapshot({
        tmdbId: context.tmdbId,
        mediaType: context.mediaType,
        prefetchedImdbId,
        forceRefresh,
      });

      const resolvedDocRef = docRef || getDocRef(userId, context.titleKey);
      const currentData = existingData || item || {};
      const patch = buildMetadataPatch(currentData, snapshot, { forceRefresh, trackStatus });

      if (persist && resolvedDocRef && patch) {
        await setDoc(resolvedDocRef, patch, { merge: true });

        if (userId) {
          invalidateLibraryPipelineCache(userId);
          invalidateContinueWatching(userId);
        }
      }

      const result = {
        ...context,
        ...snapshot,
        changed: Boolean(patch),
        hasData: snapshot.hasData,
        persisted: Boolean(persist && resolvedDocRef && patch),
        patch,
      };

      notifyMetadataUpdates(result);
      return result;
    } catch (error) {
      const failure = {
        ...context,
        changed: false,
        hasData: false,
        error,
      };
      notifyMetadataUpdates(failure);
      return failure;
    } finally {
      inFlightRequests.delete(requestKey);
    }
  })();

  inFlightRequests.set(requestKey, requestPromise);
  return requestPromise;
};
