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
exports.onEpisodeStateWritten = void 0;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-functions/v2/firestore");
const seriesProgress_1 = require("../services/seriesProgress");
/**
 * Trigger: materialize progress deltas whenever an episode state changes.
 * Path: users/{uid}/episode_states/{episodeStateKey}
 */
exports.onEpisodeStateWritten = (0, firestore_1.onDocumentWritten)('users/{uid}/episode_states/{episodeStateKey}', async (event) => {
    var _a, _b;
    const uid = event.params.uid;
    const beforeData = ((_a = event.data) === null || _a === void 0 ? void 0 : _a.before.exists) ? event.data.before.data() : null;
    const afterData = ((_b = event.data) === null || _b === void 0 ? void 0 : _b.after.exists) ? event.data.after.data() : null;
    const titleKey = String((afterData === null || afterData === void 0 ? void 0 : afterData.titleKey) || (beforeData === null || beforeData === void 0 ? void 0 : beforeData.titleKey) || '').trim();
    if (!uid || !/^tmdb_tv_\d+$/.test(titleKey)) {
        return;
    }
    const beforeWatched = (beforeData === null || beforeData === void 0 ? void 0 : beforeData.state) === 'watched' ? 1 : 0;
    const afterWatched = (afterData === null || afterData === void 0 ? void 0 : afterData.state) === 'watched' ? 1 : 0;
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
    const { episodes: catalogEpisodes, totalEpisodesCount, airedEpisodesCount } = (0, seriesProgress_1.parseCatalogEpisodes)(episodesSnap);
    const progressRef = db.collection('users').doc(uid).collection('series_progress').doc(titleKey);
    const libraryRef = db.collection('users').doc(uid).collection('library_items').doc(titleKey);
    await db.runTransaction(async (tx) => {
        var _a, _b, _c, _d, _e, _f, _g;
        const [progressSnap, librarySnap] = await Promise.all([tx.get(progressRef), tx.get(libraryRef)]);
        const progressData = progressSnap.exists ? progressSnap.data() : {};
        const libraryData = librarySnap.exists ? librarySnap.data() : {};
        const priorWatched = Number(progressData.watchedEpisodesCount || 0);
        const nextWatched = Math.max(0, priorWatched + delta);
        const completionRatioAired = airedEpisodesCount > 0 ? Math.min(1, nextWatched / airedEpisodesCount) : 0;
        const completionRatioTotal = totalEpisodesCount > 0 ? Math.min(1, nextWatched / totalEpisodesCount) : 0;
        const changedAbsoluteOrder = Number((_b = (_a = afterData === null || afterData === void 0 ? void 0 : afterData.absoluteOrder) !== null && _a !== void 0 ? _a : beforeData === null || beforeData === void 0 ? void 0 : beforeData.absoluteOrder) !== null && _b !== void 0 ? _b : -1);
        const changedSeason = Number((_d = (_c = afterData === null || afterData === void 0 ? void 0 : afterData.seasonNumber) !== null && _c !== void 0 ? _c : beforeData === null || beforeData === void 0 ? void 0 : beforeData.seasonNumber) !== null && _d !== void 0 ? _d : 0);
        const changedEpisode = Number((_f = (_e = afterData === null || afterData === void 0 ? void 0 : afterData.episodeNumber) !== null && _e !== void 0 ? _e : beforeData === null || beforeData === void 0 ? void 0 : beforeData.episodeNumber) !== null && _f !== void 0 ? _f : 0);
        const changedWatchedAt = (afterData === null || afterData === void 0 ? void 0 : afterData.watchedAt) || now;
        const existingLast = progressData.lastWatchedEpisode;
        const existingLastAbs = Number((_g = existingLast === null || existingLast === void 0 ? void 0 : existingLast.absoluteOrder) !== null && _g !== void 0 ? _g : -1);
        let lastWatchedEpisode = existingLast || null;
        let nextEpisode = progressData.nextEpisode || null;
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
        const nextStatus = (0, seriesProgress_1.deriveLibraryStatus)(existingStatus, nextWatched, airedEpisodesCount);
        (0, seriesProgress_1.upsertSeriesProgressAndLibrary)(tx, {
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
            lastWatchedAt: delta > 0 ? changedWatchedAt : libraryData.lastWatchedAt || null,
            updatedAt: now,
        });
    });
});
//# sourceMappingURL=onEpisodeStateWritten.js.map