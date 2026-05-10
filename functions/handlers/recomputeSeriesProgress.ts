import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { deriveLibraryStatus, parseCatalogEpisodes, upsertSeriesProgressAndLibrary } from '../services/seriesProgress';
import { parseTvTitleKey, requireAuthUid } from './watch/common';

interface RecomputeSeriesProgressRequest {
  titleKey: string;
}

/**
 * Callable: full rebuild of a user's series progress for one show.
 */
export const recomputeSeriesProgress = onCall(async (request) => {
  const uid = requireAuthUid(request.auth);

  const payload = (request.data || {}) as Partial<RecomputeSeriesProgressRequest>;
  const titleKey = parseTvTitleKey(payload.titleKey);

  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  const titleRef = db.collection('catalog_titles').doc(titleKey);

  const titleSnap = await titleRef.get();
  if (!titleSnap.exists) {
    throw new HttpsError('not-found', 'Title not found in catalog.');
  }
  const titleData = titleSnap.data() || {};
  if (titleData.mediaType !== 'tv') {
    throw new HttpsError('failed-precondition', 'recomputeSeriesProgress only supports TV titles.');
  }

  const [episodesSnap, watchedStatesSnap] = await Promise.all([
    titleRef.collection('episodes').get(),
    db
      .collection('users')
      .doc(uid)
      .collection('episode_states')
      .where('titleKey', '==', titleKey)
      .where('state', '==', 'watched')
      .get(),
  ]);

  if (episodesSnap.empty) {
    throw new HttpsError('not-found', 'No catalog episodes found for this title.');
  }

  const {
    episodes: catalogEpisodes,
    episodeKeyToMeta,
    totalEpisodesCount,
    airedEpisodesCount,
  } = parseCatalogEpisodes(episodesSnap);

  if (catalogEpisodes.length === 0) {
    throw new HttpsError('failed-precondition', 'Catalog episodes are invalid for this title.');
  }

  const watchedSet = new Set<string>();
  let watchedEpisodesCount = 0;
  let watchedAiredCount = 0;
  let lastWatchedEpisode: Record<string, any> | null = null;
  let highestAbsolute = -1;

  for (const doc of watchedStatesSnap.docs) {
    const d = doc.data() || {};
    const seasonNumber = Number(d.seasonNumber);
    const episodeNumber = Number(d.episodeNumber);
    const absoluteOrder = Number(d.absoluteOrder);
    const watchedAt = (d.watchedAt as admin.firestore.Timestamp | undefined) || now;

    if (!Number.isInteger(seasonNumber) || !Number.isInteger(episodeNumber) || !Number.isFinite(absoluteOrder)) {
      continue;
    }

    const key = `${seasonNumber}:${episodeNumber}`;
    if (watchedSet.has(key)) {
      continue;
    }

    watchedSet.add(key);
    watchedEpisodesCount++;

    const meta = episodeKeyToMeta.get(key);
    if (meta?.isAired) {
      watchedAiredCount++;
    }

    if (absoluteOrder > highestAbsolute) {
      highestAbsolute = absoluteOrder;
      lastWatchedEpisode = {
        seasonNumber,
        episodeNumber,
        absoluteOrder,
        watchedAt,
      };
    }
  }

  const completionRatioAired = airedEpisodesCount > 0 ? Math.min(1, watchedAiredCount / airedEpisodesCount) : 0;
  const completionRatioTotal = totalEpisodesCount > 0 ? Math.min(1, watchedEpisodesCount / totalEpisodesCount) : 0;

  const nextEpisodeCandidate = catalogEpisodes
    .filter((e) => e.isAired && !watchedSet.has(`${e.seasonNumber}:${e.episodeNumber}`))
    .sort((a, b) => a.absoluteOrder - b.absoluteOrder)[0];

  const nextEpisode = nextEpisodeCandidate
    ? {
        seasonNumber: nextEpisodeCandidate.seasonNumber,
        episodeNumber: nextEpisodeCandidate.episodeNumber,
        absoluteOrder: nextEpisodeCandidate.absoluteOrder,
        airDate: nextEpisodeCandidate.airDate,
      }
    : null;

  const progressRef = db.collection('users').doc(uid).collection('series_progress').doc(titleKey);
  const libraryRef = db.collection('users').doc(uid).collection('library_items').doc(titleKey);

  await db.runTransaction(async (tx) => {
    const librarySnap = await tx.get(libraryRef);
    const libraryData = librarySnap.exists ? (librarySnap.data() as Record<string, any>) : {};
    const existingStatus = typeof libraryData.status === 'string' ? libraryData.status : null;
    const status = deriveLibraryStatus(existingStatus, watchedAiredCount, airedEpisodesCount);

    upsertSeriesProgressAndLibrary(tx, {
      progressRef,
      libraryRef,
      titleKey,
      status,
      watchedEpisodesCount,
      airedEpisodesCount,
      totalEpisodesCount,
      completionRatioAired,
      completionRatioTotal,
      lastWatchedEpisode,
      nextEpisode,
      progressNeedsRecompute: false,
      lastWatchedAt: (lastWatchedEpisode?.watchedAt as admin.firestore.Timestamp | null) || (libraryData.lastWatchedAt as admin.firestore.Timestamp | null) || null,
      updatedAt: now,
    });
  });

  return {
    ok: true,
    titleKey,
    watchedEpisodesCount,
    watchedAiredCount,
    airedEpisodesCount,
    totalEpisodesCount,
    completionRatioAired,
    completionRatioTotal,
  };
});


