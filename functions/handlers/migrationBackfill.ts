import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import {
  buildEpisodeStateDocId,
  buildListItemWrite,
  commitWritesInChunks,
  detectMediaType,
  ensureEpisodeMapForTitle,
  EpisodeCandidate,
  extractEpisodeInfo,
  LibraryAggregate,
  parseTmdbId,
  PendingWrite,
  SourceKind,
  toTimestamp,
  upsertLibraryAggregate,
} from '../services/migrationBackfill';

interface RunPhase2BackfillRequest {
  targetUid: string;
}

/**
 * Phase 2 migration/backfill callable.
 * Secure by design: requires admin custom claim.
 */
export const runPhase2BackfillMigration = onCall(async (request) => {
  const callerUid = request.auth?.uid;
  const isAdmin = request.auth?.token?.admin === true;

  if (!callerUid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }
  if (!isAdmin) {
    throw new HttpsError('permission-denied', 'Admin privileges are required.');
  }

  const payload = (request.data || {}) as Partial<RunPhase2BackfillRequest>;
  const targetUid = typeof payload.targetUid === 'string' ? payload.targetUid.trim() : '';
  if (!targetUid) {
    throw new HttpsError('invalid-argument', 'targetUid is required.');
  }

  const db = admin.firestore();
  const now = admin.firestore.Timestamp.now();
  const reportRef = db.collection('users').doc(targetUid).collection('migration').doc('v2');

  const summary = {
    startedAt: now,
    completedAt: null as admin.firestore.Timestamp | null,
    startedBy: callerUid,
    targetUid,
    status: 'processing',
    counts: {
      legacyWatchlistDocs: 0,
      legacyWatchedDocs: 0,
      legacyCustomLists: 0,
      legacyCustomListItems: 0,
      listsCreatedOrUpdated: 0,
      listItemsWritten: 0,
      libraryItemsWritten: 0,
      episodeStatesWritten: 0,
    },
    failures: [] as Array<{ stage: string; id?: string; error: string }>,
  };

  await reportRef.set(summary, { merge: true });

  const libraryByTitle = new Map<string, LibraryAggregate>();
  const listItemWrites: PendingWrite[] = [];
  const episodeStateCandidates: EpisodeCandidate[] = [];
  const cachedEpisodeMaps = new Map<string, Map<string, { absoluteOrder: number }>>();
  const userRef = db.collection('users').doc(targetUid);

  const handleLegacyItem = async (source: SourceKind, sourceListId: string, item: any) => {
    const mediaType = detectMediaType(item);
    const tmdbId = parseTmdbId(item);
    if (!tmdbId) {
      summary.failures.push({ stage: 'parse_item', id: String(item?.id || ''), error: 'Unable to determine TMDB id.' });
      return;
    }

    const titleKey = mediaType === 'tv' ? `tmdb_tv_${tmdbId}` : `tmdb_movie_${tmdbId}`;
    const epInfo = extractEpisodeInfo(item);
    const watchedAt = toTimestamp(item?.watched_at || item?.watchedAt || item?.dateAdded || now);

    let sourceStatus: 'plan_to_watch' | 'watching' | 'completed' | null = null;
    if (source === 'watchlist') sourceStatus = 'plan_to_watch';
    if (source === 'watched') sourceStatus = epInfo ? 'watching' : 'completed';

    upsertLibraryAggregate(libraryByTitle, {
      titleKey,
      mediaType,
      sourceStatus,
      listId: sourceListId,
      item,
      watchedAt: source === 'watched' ? watchedAt : null,
    }, now);

    const itemKey = epInfo
      ? `${titleKey}_s${String(epInfo.seasonNumber).padStart(2, '0')}e${String(epInfo.episodeNumber).padStart(2, '0')}`
      : titleKey;

    listItemWrites.push(buildListItemWrite(userRef, sourceListId, itemKey, item, titleKey, mediaType, now));

    if (source === 'watched' && mediaType === 'tv' && epInfo) {
      episodeStateCandidates.push({
        titleKey,
        seasonNumber: epInfo.seasonNumber,
        episodeNumber: epInfo.episodeNumber,
        watchedAt,
        source: 'import',
      });
    }
  };

  try {
    const [watchlistSnap, watchedSnap, customListsSnap] = await Promise.all([
      userRef.collection('watchlist').get(),
      userRef.collection('watched').get(),
      userRef.collection('custom_lists').get(),
    ]);

    summary.counts.legacyWatchlistDocs = watchlistSnap.size;
    summary.counts.legacyWatchedDocs = watchedSnap.size;
    summary.counts.legacyCustomLists = customListsSnap.size;

    // Ensure system lists exist.
    const baseListWrites: PendingWrite[] = [
      {
        ref: userRef.collection('lists').doc('system_watchlist'),
        data: {
          name: 'Watchlist',
          description: 'Migrated system watchlist',
          kind: 'system_watchlist',
          visibility: 'private',
          isPinned: true,
          itemCount: watchlistSnap.size,
          createdAt: now,
          updatedAt: now,
          ownerId: targetUid,
        },
        merge: true,
      },
      {
        ref: userRef.collection('lists').doc('system_watched'),
        data: {
          name: 'Watched',
          description: 'Migrated system watched list',
          kind: 'system_watched',
          visibility: 'private',
          isPinned: true,
          itemCount: watchedSnap.size,
          createdAt: now,
          updatedAt: now,
          ownerId: targetUid,
        },
        merge: true,
      },
    ];

    await commitWritesInChunks(db, baseListWrites, (failure) => summary.failures.push(failure));
    summary.counts.listsCreatedOrUpdated += baseListWrites.length;

    for (const doc of watchlistSnap.docs) {
      await handleLegacyItem('watchlist', 'system_watchlist', doc.data() || {});
    }

    for (const doc of watchedSnap.docs) {
      await handleLegacyItem('watched', 'system_watched', doc.data() || {});
    }

    for (const listDoc of customListsSnap.docs) {
      const legacyList = listDoc.data() || {};
      const listId = listDoc.id;
      const newListRef = userRef.collection('lists').doc(listId);
      await newListRef.set({
        name: String(legacyList.name || listId).slice(0, 100),
        description: legacyList.description || null,
        kind: 'custom',
        visibility: 'private',
        isPinned: !!legacyList.isPinned,
        itemCount: 0,
        createdAt: toTimestamp(legacyList.createdAt || now),
        updatedAt: now,
        ownerId: targetUid,
      }, { merge: true });
      summary.counts.listsCreatedOrUpdated++;

      const itemsSnap = await listDoc.ref.collection('items').get();
      summary.counts.legacyCustomListItems += itemsSnap.size;

      for (const itemDoc of itemsSnap.docs) {
        await handleLegacyItem('custom', listId, itemDoc.data() || {});
      }

      await newListRef.set({ itemCount: itemsSnap.size, updatedAt: now }, { merge: true });
    }

    // Resolve absoluteOrder and enqueue episode_states writes.
    const episodeWrites: PendingWrite[] = [];
    for (const ep of episodeStateCandidates) {
      const episodeMap = await ensureEpisodeMapForTitle(
        db,
        cachedEpisodeMaps,
        ep.titleKey,
        (failure) => summary.failures.push(failure)
      );
      const key = `${ep.seasonNumber}:${ep.episodeNumber}`;
      const meta = episodeMap.get(key);
      if (!meta) {
        summary.failures.push({
          stage: 'episode_mapping',
          id: `${ep.titleKey}:${key}`,
          error: 'Catalog episode not found; skipped episode_states write.',
        });
        continue;
      }

      const stateId = buildEpisodeStateDocId(ep.titleKey, ep.seasonNumber, ep.episodeNumber);
      episodeWrites.push({
        ref: userRef.collection('episode_states').doc(stateId),
        data: {
          titleKey: ep.titleKey,
          seasonNumber: ep.seasonNumber,
          episodeNumber: ep.episodeNumber,
          absoluteOrder: meta.absoluteOrder,
          state: 'watched',
          watchedAt: ep.watchedAt,
          updatedAt: now,
          source: 'import',
        },
        merge: true,
      });
    }

    // Build library writes from aggregate map.
    const libraryWrites: PendingWrite[] = [];
    for (const agg of libraryByTitle.values()) {
      libraryWrites.push({
        ref: userRef.collection('library_items').doc(agg.titleKey),
        data: {
          titleKey: agg.titleKey,
          mediaType: agg.mediaType,
          status: agg.status,
          listIds: Array.from(agg.listIds),
          userRating: agg.userRating,
          addedAt: agg.addedAt,
          updatedAt: agg.updatedAt,
          lastWatchedAt: agg.lastWatchedAt,
          sort: agg.sort,
        },
        merge: true,
      });
    }

    await commitWritesInChunks(db, listItemWrites, (failure) => summary.failures.push(failure));
    await commitWritesInChunks(db, libraryWrites, (failure) => summary.failures.push(failure));
    await commitWritesInChunks(db, episodeWrites, (failure) => summary.failures.push(failure));

    summary.counts.listItemsWritten = listItemWrites.length;
    summary.counts.libraryItemsWritten = libraryWrites.length;
    summary.counts.episodeStatesWritten = episodeWrites.length;

    summary.status = summary.failures.length > 0 ? 'completed_with_errors' : 'completed';
    summary.completedAt = admin.firestore.Timestamp.now();

    await reportRef.set(summary, { merge: true });

    return {
      ok: true,
      targetUid,
      status: summary.status,
      counts: summary.counts,
      failures: summary.failures,
    };
  } catch (err: any) {
    summary.status = 'failed';
    summary.completedAt = admin.firestore.Timestamp.now();
    summary.failures.push({ stage: 'migration', error: String(err?.message || err) });
    await reportRef.set(summary, { merge: true });
    throw new HttpsError('internal', 'Phase 2 migration failed. See users/{uid}/migration/v2 for details.');
  }
});

