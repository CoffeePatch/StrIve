import * as admin from 'firebase-admin';
import { onDocumentWritten } from 'firebase-functions/v2/firestore';
import { deriveLibraryStatus, parseCatalogEpisodes, upsertSeriesProgressAndLibrary } from '../services/seriesProgress';


/**
 * Trigger: materialize progress deltas whenever an episode state changes.
 * Path: users/{uid}/episode_states/{episodeStateKey}
 */
export const onEpisodeStateWritten = onDocumentWritten('users/{uid}/episode_states/{episodeStateKey}', async (event) => {
  const uid = event.params.uid;
  const beforeData = event.data?.before.exists ? (event.data.before.data() as Record<string, any>) : null;
  const afterData = event.data?.after.exists ? (event.data.after.data() as Record<string, any>) : null;

  const titleKey = String(afterData?.titleKey || beforeData?.titleKey || '').trim();
  if (!uid || !/^tmdb_tv_\d+$/.test(titleKey)) {
    return;
  }

  const beforeWatched = beforeData?.state === 'watched' ? 1 : 0;
  const afterWatched = afterData?.state === 'watched' ? 1 : 0;
  const delta = afterWatched - beforeWatched;

  // Ignore no-op state writes.
  if (delta === 0 && !!afterData === !!beforeData) {
    return;
  }

  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();

  const titleRef = db.collection('catalog_titles').doc(titleKey);
  const episodesSnap = await titleRef.collection('episodes').get();
  if (episodesSnap.empty) {
    return;
  }

  const { episodes: catalogEpisodes, totalEpisodesCount, airedEpisodesCount } = parseCatalogEpisodes(episodesSnap);

  const progressRef = db.collection('users').doc(uid).collection('series_progress').doc(titleKey);
  const libraryRef = db.collection('users').doc(uid).collection('library_items').doc(titleKey);

  await db.runTransaction(async (tx) => {
    const [progressSnap, librarySnap] = await Promise.all([tx.get(progressRef), tx.get(libraryRef)]);
    const progressData = progressSnap.exists ? (progressSnap.data() as Record<string, any>) : {};
    const libraryData = librarySnap.exists ? (librarySnap.data() as Record<string, any>) : {};

    const priorWatched = Number(progressData.watchedEpisodesCount || 0);
    const nextWatched = Math.max(0, priorWatched + delta);
    const completionRatioAired = airedEpisodesCount > 0 ? Math.min(1, nextWatched / airedEpisodesCount) : 0;
    const completionRatioTotal = totalEpisodesCount > 0 ? Math.min(1, nextWatched / totalEpisodesCount) : 0;

    const changedAbsoluteOrder = Number(afterData?.absoluteOrder ?? beforeData?.absoluteOrder ?? -1);
    const changedSeason = Number(afterData?.seasonNumber ?? beforeData?.seasonNumber ?? 0);
    const changedEpisode = Number(afterData?.episodeNumber ?? beforeData?.episodeNumber ?? 0);
    const changedWatchedAt = (afterData?.watchedAt as admin.firestore.Timestamp | undefined) || now;

    const existingLast = progressData.lastWatchedEpisode as Record<string, any> | null;
    const existingLastAbs = Number(existingLast?.absoluteOrder ?? -1);

    let lastWatchedEpisode: Record<string, any> | null = existingLast || null;
    let nextEpisode: Record<string, any> | null = progressData.nextEpisode || null;
    let progressNeedsRecompute = false;

    if (delta > 0 && changedAbsoluteOrder >= 0) {
      if (!lastWatchedEpisode || changedAbsoluteOrder >= existingLastAbs) {
        lastWatchedEpisode = {
          seasonNumber: changedSeason,
          episodeNumber: changedEpisode,
          absoluteOrder: changedAbsoluteOrder,
          watchedAt: changedWatchedAt,
        };

        const upcoming = catalogEpisodes
          .filter((e) => e.isAired && e.absoluteOrder > changedAbsoluteOrder)
          .sort((a, b) => a.absoluteOrder - b.absoluteOrder)[0];

        nextEpisode = upcoming ? {
          seasonNumber: upcoming.seasonNumber,
          episodeNumber: upcoming.episodeNumber,
          absoluteOrder: upcoming.absoluteOrder,
          airDate: null,
        } : null;
      }
    }

    if (delta < 0) {
      // Deletions/unwatch can invalidate lastWatched/nextEpisode ordering.
      progressNeedsRecompute = true;
      nextEpisode = null;
    }

    const existingStatus = typeof libraryData.status === 'string' ? libraryData.status : null;
    const nextStatus = deriveLibraryStatus(existingStatus, nextWatched, airedEpisodesCount);

    upsertSeriesProgressAndLibrary(tx, {
      progressRef,
      libraryRef,
      titleKey,
      status: nextStatus,
      watchedEpisodesCount: nextWatched,
      airedEpisodesCount,
      totalEpisodesCount,
      completionRatioAired,
      completionRatioTotal,
      lastWatchedEpisode,
      nextEpisode,
      progressNeedsRecompute,
      lastWatchedAt: delta > 0 ? changedWatchedAt : (libraryData.lastWatchedAt as admin.firestore.Timestamp | null) || null,
      updatedAt: now,
    });
  });
});

