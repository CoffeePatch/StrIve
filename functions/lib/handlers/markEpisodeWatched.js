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
exports.markEpisodeWatched = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const common_1 = require("./watch/common");
const watchMutation_1 = require("../services/watchMutation");
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
exports.markEpisodeWatched = (0, https_1.onCall)(async (request) => {
    const uid = (0, common_1.requireAuthUid)(request.auth);
    const payload = (request.data || {});
    const titleKey = (0, common_1.parseTvTitleKey)(payload.titleKey);
    const mode = payload.mode;
    const seasonNumber = Number(payload.seasonNumber);
    const episodeNumber = Number(payload.episodeNumber);
    const requestId = typeof payload.requestId === 'string' ? payload.requestId.trim() : '';
    const inputEpisodeCatalog = Array.isArray(payload.episodeCatalog) ? payload.episodeCatalog : [];
    if (!mode || !['single', 'backfill_to_episode', 'season_all'].includes(mode)) {
        throw new https_1.HttpsError('invalid-argument', 'mode must be one of: single, backfill_to_episode, season_all.');
    }
    if (!Number.isInteger(seasonNumber) || seasonNumber < 1) {
        throw new https_1.HttpsError('invalid-argument', 'seasonNumber must be a positive integer.');
    }
    if (!Number.isInteger(episodeNumber) || episodeNumber < 1) {
        throw new https_1.HttpsError('invalid-argument', 'episodeNumber must be a positive integer.');
    }
    const db = admin.firestore();
    const now = firestore_1.Timestamp.now();
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
                    throw new https_1.HttpsError('already-exists', 'This requestId has already been processed.');
                }
            }
            if (lockSnap.exists) {
                const lockData = lockSnap.data() || {};
                const expiresAtMs = (0, watchMutation_1.resolveExpiresAtMs)(lockData.expiresAt);
                if (expiresAtMs > nowMs) {
                    throw new https_1.HttpsError('aborted', 'A watch mutation is already in progress for this title.');
                }
            }
            tx.set(lockRef, {
                titleKey,
                status: 'locked',
                requestId: actionId,
                lockedAt: now,
                expiresAt: firestore_1.Timestamp.fromMillis(nowMs + ttlMs),
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
    }
    catch (err) {
        if (err instanceof https_1.HttpsError) {
            throw err;
        }
        console.error('markEpisodeWatched lock transaction failed:', err);
        throw new https_1.HttpsError('internal', 'Failed to initialize watch mutation.');
    }
    let matchedCount = 0;
    let skippedAlreadyWatched = 0;
    try {
        const titleRef = db.collection('catalog_titles').doc(titleKey);
        const allEpisodes = await (0, watchMutation_1.loadEpisodesForMutation)(titleRef, inputEpisodeCatalog);
        const { selected } = (0, watchMutation_1.selectEpisodesForMode)(allEpisodes, mode, seasonNumber, episodeNumber);
        // Preload existing states so we can avoid unnecessary writes.
        const stateRefs = selected.map((e) => {
            const stateId = (0, watchMutation_1.buildEpisodeStateId)(titleKey, e.seasonNumber, e.episodeNumber);
            return db.collection('users').doc(uid).collection('episode_states').doc(stateId);
        });
        const existingSnaps = await db.getAll(...stateRefs);
        const writes = [];
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
            await (0, watchMutation_1.commitMergeWritesInChunks)(db, writes, 500);
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
                completedAt: firestore_1.Timestamp.now(),
                updatedAt: firestore_1.Timestamp.now(),
            }, { merge: true });
            tx.set(lockRef, {
                status: 'released',
                releasedAt: firestore_1.Timestamp.now(),
                expiresAt: firestore_1.Timestamp.fromMillis(nowMs),
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
    }
    catch (err) {
        console.error('markEpisodeWatched failed:', {
            uid,
            titleKey,
            mode,
            seasonNumber,
            episodeNumber,
            requestId: actionId,
            error: (err === null || err === void 0 ? void 0 : err.message) || err,
        });
        try {
            await db.runTransaction(async (tx) => {
                tx.set(actionRef, {
                    status: 'failed',
                    matchedCount,
                    skippedAlreadyWatched,
                    error: String((err === null || err === void 0 ? void 0 : err.message) || 'Unknown error'),
                    failedAt: firestore_1.Timestamp.now(),
                    updatedAt: firestore_1.Timestamp.now(),
                }, { merge: true });
                tx.set(lockRef, {
                    status: 'released',
                    releasedAt: firestore_1.Timestamp.now(),
                    expiresAt: firestore_1.Timestamp.fromMillis(nowMs),
                }, { merge: true });
            });
        }
        catch (cleanupErr) {
            console.error('markEpisodeWatched cleanup failed:', cleanupErr);
        }
        throw (0, common_1.toSafeHttpsError)(err, 'Failed to mark episodes as watched.');
    }
});
//# sourceMappingURL=markEpisodeWatched.js.map