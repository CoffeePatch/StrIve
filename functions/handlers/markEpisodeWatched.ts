import * as admin from 'firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { parseTvTitleKey, requireAuthUid, toSafeHttpsError } from './watch/common';
import {
  buildEpisodeStateId,
  commitMergeWritesInChunks,
  EpisodeCatalogInputRow,
  loadEpisodesForMutation,
  resolveExpiresAtMs,
  selectEpisodesForMode,
  WatchMode,
} from '../services/watchMutation';


interface MarkEpisodeWatchedRequest {
  titleKey: string;
  seasonNumber: number;
  episodeNumber: number;
  mode: WatchMode;
  requestId?: string;
  episodeCatalog?: EpisodeCatalogInputRow[];
}

/**
 * Callable: marks TV episodes watched with support for:
 * - single episode
 * - backfill from S1E1 to target episode (aired episodes only)
 * - all aired episodes in target season
 *
 * Uses:
 * - transaction for mutation lock + action lifecycle
 * - chunked write batches (<= 500 operations each)
 */
export const markEpisodeWatched = onCall(async (request) => {
  const uid = requireAuthUid(request.auth);

  const payload = (request.data || {}) as Partial<MarkEpisodeWatchedRequest>;
  const titleKey = parseTvTitleKey(payload.titleKey);
  const mode = payload.mode;
  const seasonNumber = Number(payload.seasonNumber);
  const episodeNumber = Number(payload.episodeNumber);
  const requestId = typeof payload.requestId === 'string' ? payload.requestId.trim() : '';
  const inputEpisodeCatalog = Array.isArray(payload.episodeCatalog) ? payload.episodeCatalog : [];

  if (!mode || !['single', 'backfill_to_episode', 'season_all'].includes(mode)) {
    throw new HttpsError('invalid-argument', 'mode must be one of: single, backfill_to_episode, season_all.');
  }
  if (!Number.isInteger(seasonNumber) || seasonNumber < 1) {
    throw new HttpsError('invalid-argument', 'seasonNumber must be a positive integer.');
  }
  if (!Number.isInteger(episodeNumber) || episodeNumber < 1) {
    throw new HttpsError('invalid-argument', 'episodeNumber must be a positive integer.');
  }

  const db = admin.firestore();
  const now = Timestamp.now();
  const nowMs = Date.now();
  const ttlMs = 2 * 60 * 1000;
  const lockDocId = `${titleKey}_watch_lock`;
  const lockRef = db.collection('users').doc(uid).collection('watch_mutation_locks').doc(lockDocId);
  const actionId = requestId || db.collection('_').doc().id;
  const actionRef = db.collection('users').doc(uid).collection('watch_actions').doc(actionId);

  // Transaction 1: acquire lock + register action intent
  try {
    await db.runTransaction(async (tx) => {
      const [lockSnap, actionSnap] = await Promise.all([tx.get(lockRef), tx.get(actionRef)]);

      if (actionSnap.exists) {
        const prior = actionSnap.data() || {};
        if (prior.status === 'completed') {
          throw new HttpsError('already-exists', 'This requestId has already been processed.');
        }
      }

      if (lockSnap.exists) {
        const lockData = lockSnap.data() || {};
        const expiresAtMs = resolveExpiresAtMs(lockData.expiresAt);
        if (expiresAtMs > nowMs) {
          throw new HttpsError('aborted', 'A watch mutation is already in progress for this title.');
        }
      }

      tx.set(lockRef, {
        titleKey,
        status: 'locked',
        requestId: actionId,
        lockedAt: now,
        expiresAt: Timestamp.fromMillis(nowMs + ttlMs),
      }, { merge: true });

      tx.set(actionRef, {
        requestId: actionId,
        uid,
        titleKey,
        mode,
        seasonNumber,
        episodeNumber,
        status: 'processing',
        createdAt: now,
        updatedAt: now,
      }, { merge: true });
    });
  } catch (err: any) {
    if (err instanceof HttpsError) {
      throw err;
    }
    console.error('markEpisodeWatched lock transaction failed:', err);
    throw new HttpsError('internal', 'Failed to initialize watch mutation.');
  }

  let matchedCount = 0;
  let skippedAlreadyWatched = 0;

  try {
    const titleRef = db.collection('catalog_titles').doc(titleKey);

    const allEpisodes = await loadEpisodesForMutation(titleRef, inputEpisodeCatalog);
    const { selected } = selectEpisodesForMode(allEpisodes, mode, seasonNumber, episodeNumber);

    type PendingWrite = {
      ref: FirebaseFirestore.DocumentReference;
      data: FirebaseFirestore.DocumentData;
    };

    // Auto-seed the catalog if it was empty, using the fallback payload
    if (inputEpisodeCatalog && inputEpisodeCatalog.length > 0) {
      const episodesSnap = await titleRef.collection('episodes').limit(1).get();
      if (episodesSnap.empty) {
        const seedWrites: PendingWrite[] = [];
        seedWrites.push({
          ref: titleRef,
          data: {
            titleKey,
            mediaType: 'tv',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }
        });
        for (const ep of allEpisodes) {
          const epId = `${ep.seasonNumber}_${ep.episodeNumber}`;
          seedWrites.push({
            ref: titleRef.collection('episodes').doc(epId),
            data: ep
          });
        }
        await commitMergeWritesInChunks(db, seedWrites, 500);
      }
    }

    // Preload existing states so we can avoid unnecessary writes.
    const stateRefs = selected.map((e) => {
      const stateId = buildEpisodeStateId(titleKey, e.seasonNumber, e.episodeNumber);
      return db.collection('users').doc(uid).collection('episode_states').doc(stateId);
    });

    const existingSnaps = await db.getAll(...stateRefs);


    const writes: PendingWrite[] = [];

    for (let i = 0; i < selected.length; i++) {
      const ep = selected[i];
      const existing = existingSnaps[i];
      const existingData = existing.exists ? (existing.data() || {}) : null;
      if (existingData && existingData.state === 'watched') {
        skippedAlreadyWatched++;
        continue;
      }

      writes.push({
        ref: stateRefs[i],
        data: {
          titleKey,
          seasonNumber: ep.seasonNumber,
          episodeNumber: ep.episodeNumber,
          absoluteOrder: ep.absoluteOrder,
          state: 'watched',
          watchedAt: now,
          updatedAt: now,
          source: 'manual',
        },
      });
    }

    matchedCount = selected.length;

    if (writes.length > 0) {
      await commitMergeWritesInChunks(db, writes, 500);
    }

    // Mark title-level progress as stale; dedicated recompute logic can process it later.
    await db.collection('users').doc(uid).collection('library_items').doc(titleKey).set({
      updatedAt: now,
      progressNeedsRecompute: true,
    }, { merge: true });

    // Transaction 2: complete action + release lock
    await db.runTransaction(async (tx) => {
      tx.set(actionRef, {
        status: 'completed',
        matchedCount,
        writtenCount: writes.length,
        skippedAlreadyWatched,
        completedAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      }, { merge: true });

      tx.set(lockRef, {
        status: 'released',
        releasedAt: Timestamp.now(),
        expiresAt: Timestamp.fromMillis(nowMs),
      }, { merge: true });
    });

    return {
      ok: true,
      requestId: actionId,
      mode,
      matchedCount,
      writtenCount: writes.length,
      skippedAlreadyWatched,
    };
  } catch (err: any) {
    console.error('markEpisodeWatched failed:', {
      uid,
      titleKey,
      mode,
      seasonNumber,
      episodeNumber,
      requestId: actionId,
      error: err?.message || err,
    });

    try {
      await db.runTransaction(async (tx) => {
        tx.set(actionRef, {
          status: 'failed',
          matchedCount,
          skippedAlreadyWatched,
          error: String(err?.message || 'Unknown error'),
          failedAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
        }, { merge: true });

        tx.set(lockRef, {
          status: 'released',
          releasedAt: Timestamp.now(),
          expiresAt: Timestamp.fromMillis(nowMs),
        }, { merge: true });
      });
    } catch (cleanupErr) {
      console.error('markEpisodeWatched cleanup failed:', cleanupErr);
    }

    throw toSafeHttpsError(err, 'Failed to mark episodes as watched.');
  }
});
