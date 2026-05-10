"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.upsertSeriesProgressAndLibrary = exports.buildWatchCounters = exports.deriveLibraryStatus = exports.parseCatalogEpisodes = void 0;
function parseCatalogEpisodes(episodesSnap) {
    const episodes = [];
    const episodeKeyToMeta = new Map();
    let totalEpisodesCount = 0;
    let airedEpisodesCount = 0;
    for (const doc of episodesSnap.docs) {
        const d = doc.data() || {};
        const seasonNumber = Number(d.seasonNumber);
        const episodeNumber = Number(d.episodeNumber);
        const absoluteOrder = Number(d.absoluteOrder);
        const isAired = !!d.isAired;
        const airDate = d.airDate || null;
        if (!Number.isInteger(seasonNumber) || !Number.isInteger(episodeNumber) || !Number.isFinite(absoluteOrder)) {
            continue;
        }
        const ep = {
            seasonNumber,
            episodeNumber,
            absoluteOrder,
            isAired,
            airDate,
        };
        const key = `${seasonNumber}:${episodeNumber}`;
        episodeKeyToMeta.set(key, ep);
        episodes.push(ep);
        totalEpisodesCount++;
        if (isAired)
            airedEpisodesCount++;
    }
    return {
        episodes,
        episodeKeyToMeta,
        totalEpisodesCount,
        airedEpisodesCount,
    };
}
exports.parseCatalogEpisodes = parseCatalogEpisodes;
function deriveLibraryStatus(existingStatus, watchedEpisodesCount, airedEpisodesCount) {
    if (watchedEpisodesCount <= 0) {
        return existingStatus === 'plan_to_watch' || existingStatus === 'dropped' ? existingStatus : null;
    }
    if (airedEpisodesCount > 0 && watchedEpisodesCount >= airedEpisodesCount) {
        return 'completed';
    }
    return 'watching';
}
exports.deriveLibraryStatus = deriveLibraryStatus;
function buildWatchCounters(watchedEpisodesCount, totalEpisodesCount, airedEpisodesCount, completionRatioAired) {
    return {
        watchedEpisodesCount,
        totalEpisodesCount,
        airedEpisodesCount,
        unAiredEpisodesCount: Math.max(0, totalEpisodesCount - airedEpisodesCount),
        completionRatio: completionRatioAired,
    };
}
exports.buildWatchCounters = buildWatchCounters;
function upsertSeriesProgressAndLibrary(tx, args) {
    tx.set(args.progressRef, {
        titleKey: args.titleKey,
        watchedEpisodesCount: args.watchedEpisodesCount,
        airedEpisodesCount: args.airedEpisodesCount,
        totalEpisodesCount: args.totalEpisodesCount,
        completionRatioAired: args.completionRatioAired,
        completionRatioTotal: args.completionRatioTotal,
        lastWatchedEpisode: args.lastWatchedEpisode,
        nextEpisode: args.nextEpisode,
        progressNeedsRecompute: args.progressNeedsRecompute,
        updatedAt: args.updatedAt,
    }, { merge: true });
    tx.set(args.libraryRef, {
        titleKey: args.titleKey,
        mediaType: 'tv',
        status: args.status,
        watchCounters: buildWatchCounters(args.watchedEpisodesCount, args.totalEpisodesCount, args.airedEpisodesCount, args.completionRatioAired),
        progressNeedsRecompute: args.progressNeedsRecompute,
        lastWatchedAt: args.lastWatchedAt,
        updatedAt: args.updatedAt,
    }, { merge: true });
}
exports.upsertSeriesProgressAndLibrary = upsertSeriesProgressAndLibrary;
//# sourceMappingURL=seriesProgress.js.map