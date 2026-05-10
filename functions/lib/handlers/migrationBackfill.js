"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPhase2BackfillMigration = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const migrationBackfill_1 = require("../services/migrationBackfill");
/**
 * Phase 2 migration/backfill callable.
 * Secure by design: requires admin custom claim.
 */
exports.runPhase2BackfillMigration = (0, https_1.onCall)(async (request) => {
    var _a, _b, _c;
    const callerUid = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
    const isAdmin = ((_c = (_b = request.auth) === null || _b === void 0 ? void 0 : _b.token) === null || _c === void 0 ? void 0 : _c.admin) === true;
    if (!callerUid) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication is required.');
    }
    if (!isAdmin) {
        throw new https_1.HttpsError('permission-denied', 'Admin privileges are required.');
    }
    const payload = (request.data || {});
    const targetUid = typeof payload.targetUid === 'string' ? payload.targetUid.trim() : '';
    if (!targetUid) {
        throw new https_1.HttpsError('invalid-argument', 'targetUid is required.');
    }
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const reportRef = db.collection('users').doc(targetUid).collection('migration').doc('v2');
    const summary = {
        startedAt: now,
        completedAt: null,
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
        failures: [],
    };
    await reportRef.set(summary, { merge: true });
    const libraryByTitle = new Map();
    const listItemWrites = [];
    const episodeStateCandidates = [];
    const cachedEpisodeMaps = new Map();
    const userRef = db.collection('users').doc(targetUid);
    const handleLegacyItem = async (source, sourceListId, item) => {
        const mediaType = (0, migrationBackfill_1.detectMediaType)(item);
        const tmdbId = (0, migrationBackfill_1.parseTmdbId)(item);
        if (!tmdbId) {
            summary.failures.push({ stage: 'parse_item', id: String((item === null || item === void 0 ? void 0 : item.id) || ''), error: 'Unable to determine TMDB id.' });
            return;
        }
        const titleKey = mediaType === 'tv' ? `tmdb_tv_${tmdbId}` : `tmdb_movie_${tmdbId}`;
        const epInfo = (0, migrationBackfill_1.extractEpisodeInfo)(item);
        const watchedAt = (0, migrationBackfill_1.toTimestamp)((item === null || item === void 0 ? void 0 : item.watched_at) || (item === null || item === void 0 ? void 0 : item.watchedAt) || (item === null || item === void 0 ? void 0 : item.dateAdded) || now);
        let sourceStatus = null;
        if (source === 'watchlist')
            sourceStatus = 'plan_to_watch';
        if (source === 'watched')
            sourceStatus = epInfo ? 'watching' : 'completed';
        (0, migrationBackfill_1.upsertLibraryAggregate)(libraryByTitle, {
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
        listItemWrites.push((0, migrationBackfill_1.buildListItemWrite)(userRef, sourceListId, itemKey, item, titleKey, mediaType, now));
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
        const baseListWrites = [
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
        await (0, migrationBackfill_1.commitWritesInChunks)(db, baseListWrites, (failure) => summary.failures.push(failure));
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
                createdAt: (0, migrationBackfill_1.toTimestamp)(legacyList.createdAt || now),
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
        const episodeWrites = [];
        for (const ep of episodeStateCandidates) {
            const episodeMap = await (0, migrationBackfill_1.ensureEpisodeMapForTitle)(db, cachedEpisodeMaps, ep.titleKey, (failure) => summary.failures.push(failure));
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
            const stateId = (0, migrationBackfill_1.buildEpisodeStateDocId)(ep.titleKey, ep.seasonNumber, ep.episodeNumber);
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
        const libraryWrites = [];
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
        await (0, migrationBackfill_1.commitWritesInChunks)(db, listItemWrites, (failure) => summary.failures.push(failure));
        await (0, migrationBackfill_1.commitWritesInChunks)(db, libraryWrites, (failure) => summary.failures.push(failure));
        await (0, migrationBackfill_1.commitWritesInChunks)(db, episodeWrites, (failure) => summary.failures.push(failure));
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
    }
    catch (err) {
        summary.status = 'failed';
        summary.completedAt = admin.firestore.Timestamp.now();
        summary.failures.push({ stage: 'migration', error: String((err === null || err === void 0 ? void 0 : err.message) || err) });
        await reportRef.set(summary, { merge: true });
        throw new https_1.HttpsError('internal', 'Phase 2 migration failed. See users/{uid}/migration/v2 for details.');
    }
});
//# sourceMappingURL=migrationBackfill.js.map