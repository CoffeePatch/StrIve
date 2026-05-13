import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { onCall } from 'firebase-functions/v2/https';
import { parseTvTitleKey, requireAuthUid, toSafeHttpsError } from './watch/common';
import { buildWatchCounters } from '../services/seriesProgress';

interface UnwatchSeriesRequest {
  titleKey: string;
}

/**
 * Callable: unwatch an entire TV series.
 *
 * 1. Deletes all episode_states for the series.
 * 2. Resets series_progress to zero.
 * 3. Sets library_items status to plan_to_watch.
 */
export const unwatchSeries = onCall(async (request) => {
  const uid = requireAuthUid(request.auth);

  const payload = (request.data || {}) as Partial<UnwatchSeriesRequest>;
  const titleKey = parseTvTitleKey(payload.titleKey);

  const db = admin.firestore();
  const now = Timestamp.now();

  try {
    // 1. Query all episode_states for this series
    const statesSnap = await db
      .collection('users').doc(uid)
      .collection('episode_states')
      .where('titleKey', '==', titleKey)
      .get();

    const deletedCount = statesSnap.size;

    // 2. Batch-delete all episode_states
    if (!statesSnap.empty) {
      const MAX_BATCH = 500;
      for (let i = 0; i < statesSnap.docs.length; i += MAX_BATCH) {
        const chunk = statesSnap.docs.slice(i, i + MAX_BATCH);
        const batch = db.batch();
        for (const doc of chunk) {
          batch.delete(doc.ref);
        }
        await batch.commit();
      }
    }

    // 3. Reset series_progress and library_items in a transaction
    const progressRef = db.collection('users').doc(uid).collection('series_progress').doc(titleKey);
    const libraryRef = db.collection('users').doc(uid).collection('library_items').doc(titleKey);

    await db.runTransaction(async (tx) => {
      const [progressSnap, librarySnap] = await Promise.all([
        tx.get(progressRef),
        tx.get(libraryRef),
      ]);

      const progressData = progressSnap.exists ? (progressSnap.data() || {}) : {};

      // Preserve total/aired episode counts — only zero out watched stats
      const airedEpisodesCount = Number(progressData.airedEpisodesCount || 0);
      const totalEpisodesCount = Number(progressData.totalEpisodesCount || 0);

      tx.set(progressRef, {
        titleKey,
        watchedEpisodesCount: 0,
        airedEpisodesCount,
        totalEpisodesCount,
        completionRatioAired: 0,
        completionRatioTotal: 0,
        lastWatchedEpisode: null,
        nextEpisode: null,
        progressNeedsRecompute: false,
        updatedAt: now,
      }, { merge: true });

      if (librarySnap.exists) {
        tx.set(libraryRef, {
          status: 'plan_to_watch',
          watchCounters: buildWatchCounters(0, totalEpisodesCount, airedEpisodesCount, 0),
          progressNeedsRecompute: false,
          lastWatchedAt: null,
          updatedAt: now,
        }, { merge: true });
      }
    });

    return {
      ok: true,
      titleKey,
      deletedCount,
    };
  } catch (err: any) {
    console.error('unwatchSeries failed:', { uid, titleKey, error: err?.message || err });
    throw toSafeHttpsError(err, 'Failed to unwatch series.');
  }
});
