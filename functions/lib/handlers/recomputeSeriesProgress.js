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
exports.recomputeSeriesProgress = void 0;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const seriesProgress_1 = require("../services/seriesProgress");
const common_1 = require("./watch/common");
/**
 * Callable: full rebuild of a user's series progress for one show.
 */
exports.recomputeSeriesProgress = (0, https_1.onCall)(async (request) => {
    const uid = (0, common_1.requireAuthUid)(request.auth);
    const payload = (request.data || {});
    const titleKey = (0, common_1.parseTvTitleKey)(payload.titleKey);
    const db = admin.firestore();
    const now = admin.firestore.Timestamp.now();
    const titleRef = db.collection('catalog_titles').doc(titleKey);
    const titleSnap = await titleRef.get();
    if (!titleSnap.exists) {
        throw new https_1.HttpsError('not-found', 'Title not found in catalog.');
    }
    const titleData = titleSnap.data() || {};
    if (titleData.mediaType !== 'tv') {
        throw new https_1.HttpsError('failed-precondition', 'recomputeSeriesProgress only supports TV titles.');
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
        throw new https_1.HttpsError('not-found', 'No catalog episodes found for this title.');
    }
    const { episodes: catalogEpisodes, episodeKeyToMeta, totalEpisodesCount, airedEpisodesCount, } = (0, seriesProgress_1.parseCatalogEpisodes)(episodesSnap);
    if (catalogEpisodes.length === 0) {
        throw new https_1.HttpsError('failed-precondition', 'Catalog episodes are invalid for this title.');
    }
    const watchedSet = new Set();
    let watchedEpisodesCount = 0;
    let watchedAiredCount = 0;
    let lastWatchedEpisode = null;
    let highestAbsolute = -1;
    for (const doc of watchedStatesSnap.docs) {
        const d = doc.data() || {};
        const seasonNumber = Number(d.seasonNumber);
        const episodeNumber = Number(d.episodeNumber);
        const absoluteOrder = Number(d.absoluteOrder);
        const watchedAt = d.watchedAt || now;
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
        if (meta === null || meta === void 0 ? void 0 : meta.isAired) {
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
        const libraryData = librarySnap.exists ? librarySnap.data() : {};
        const existingStatus = typeof libraryData.status === 'string' ? libraryData.status : null;
        const status = (0, seriesProgress_1.deriveLibraryStatus)(existingStatus, watchedAiredCount, airedEpisodesCount);
        (0, seriesProgress_1.upsertSeriesProgressAndLibrary)(tx, {
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
            lastWatchedAt: (lastWatchedEpisode === null || lastWatchedEpisode === void 0 ? void 0 : lastWatchedEpisode.watchedAt) || libraryData.lastWatchedAt || null,
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
//# sourceMappingURL=recomputeSeriesProgress.js.map