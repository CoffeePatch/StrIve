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
exports.unwatchSeries = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const common_1 = require("./watch/common");
const seriesProgress_1 = require("../services/seriesProgress");
/**
 * Callable: unwatch an entire TV series.
 *
 * 1. Deletes all episode_states for the series.
 * 2. Resets series_progress to zero.
 * 3. Sets library_items status to plan_to_watch.
 */
exports.unwatchSeries = (0, https_1.onCall)(async (request) => {
    const uid = (0, common_1.requireAuthUid)(request.auth);
    const payload = (request.data || {});
    const titleKey = (0, common_1.parseTvTitleKey)(payload.titleKey);
    const db = admin.firestore();
    const now = firestore_1.Timestamp.now();
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
                    watchCounters: (0, seriesProgress_1.buildWatchCounters)(0, totalEpisodesCount, airedEpisodesCount, 0),
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
    }
    catch (err) {
        console.error('unwatchSeries failed:', { uid, titleKey, error: (err === null || err === void 0 ? void 0 : err.message) || err });
        throw (0, common_1.toSafeHttpsError)(err, 'Failed to unwatch series.');
    }
});
//# sourceMappingURL=unwatchSeries.js.map