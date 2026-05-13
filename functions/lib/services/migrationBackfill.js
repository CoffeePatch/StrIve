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
exports.commitWritesInChunks = exports.buildListItemWrite = exports.buildEpisodeStateDocId = exports.ensureEpisodeMapForTitle = exports.upsertLibraryAggregate = exports.computeYear = exports.normalizeTitle = exports.extractEpisodeInfo = exports.parseTmdbId = exports.detectMediaType = exports.toTimestamp = void 0;
const admin = __importStar(require("firebase-admin"));
function toTimestamp(v) {
    if (!v)
        return admin.firestore.Timestamp.now();
    if (v instanceof admin.firestore.Timestamp)
        return v;
    if (v instanceof Date)
        return admin.firestore.Timestamp.fromDate(v);
    if (typeof v === 'string' || typeof v === 'number') {
        const d = new Date(v);
        if (!isNaN(d.getTime()))
            return admin.firestore.Timestamp.fromDate(d);
    }
    return admin.firestore.Timestamp.now();
}
exports.toTimestamp = toTimestamp;
function detectMediaType(item) {
    if ((item === null || item === void 0 ? void 0 : item.media_type) === 'tv')
        return 'tv';
    if ((item === null || item === void 0 ? void 0 : item.media_type) === 'movie')
        return 'movie';
    if ((item === null || item === void 0 ? void 0 : item.first_air_date) || (item === null || item === void 0 ? void 0 : item.tvShowId) || (item === null || item === void 0 ? void 0 : item.showId) || (item === null || item === void 0 ? void 0 : item.type) === 'tv_episode')
        return 'tv';
    return 'movie';
}
exports.detectMediaType = detectMediaType;
function parseTmdbId(item) {
    const candidates = [item === null || item === void 0 ? void 0 : item.tmdbId, item === null || item === void 0 ? void 0 : item.id, item === null || item === void 0 ? void 0 : item.tvShowId, item === null || item === void 0 ? void 0 : item.showId];
    for (const c of candidates) {
        if (typeof c === 'number' && Number.isFinite(c))
            return Math.trunc(c);
        if (typeof c === 'string') {
            const match = c.match(/(\d+)/);
            if (match)
                return Number(match[1]);
        }
    }
    return null;
}
exports.parseTmdbId = parseTmdbId;
function extractEpisodeInfo(item) {
    var _a, _b;
    const seasonRaw = (_a = item === null || item === void 0 ? void 0 : item.seasonNumber) !== null && _a !== void 0 ? _a : item === null || item === void 0 ? void 0 : item.season_number;
    const episodeRaw = (_b = item === null || item === void 0 ? void 0 : item.episodeNumber) !== null && _b !== void 0 ? _b : item === null || item === void 0 ? void 0 : item.episode_number;
    const seasonNumber = Number(seasonRaw);
    const episodeNumber = Number(episodeRaw);
    if (Number.isInteger(seasonNumber) && seasonNumber > 0 && Number.isInteger(episodeNumber) && episodeNumber > 0) {
        return { seasonNumber, episodeNumber };
    }
    const idStr = String((item === null || item === void 0 ? void 0 : item.id) || '');
    const m = idStr.match(/[sS](\d+)[eE](\d+)/);
    if (m) {
        return {
            seasonNumber: Number(m[1]),
            episodeNumber: Number(m[2]),
        };
    }
    return null;
}
exports.extractEpisodeInfo = extractEpisodeInfo;
function normalizeTitle(item) {
    return String((item === null || item === void 0 ? void 0 : item.title) || (item === null || item === void 0 ? void 0 : item.name) || '').trim();
}
exports.normalizeTitle = normalizeTitle;
function computeYear(item) {
    const dateValue = (item === null || item === void 0 ? void 0 : item.release_date) || (item === null || item === void 0 ? void 0 : item.first_air_date);
    if (!dateValue)
        return null;
    const d = new Date(dateValue);
    if (isNaN(d.getTime()))
        return null;
    return d.getUTCFullYear();
}
exports.computeYear = computeYear;
function statusPriority(s) {
    if (s === 'completed')
        return 4;
    if (s === 'watching')
        return 3;
    if (s === 'plan_to_watch')
        return 2;
    if (s === 'dropped')
        return 1;
    return 0;
}
function upsertLibraryAggregate(libraryByTitle, args, now) {
    var _a, _b, _c, _d, _e, _f;
    const existing = libraryByTitle.get(args.titleKey);
    const addedAt = toTimestamp(((_a = args.item) === null || _a === void 0 ? void 0 : _a.dateAdded) || ((_b = args.item) === null || _b === void 0 ? void 0 : _b.addedAt) || now);
    const tmdbRating = typeof ((_c = args.item) === null || _c === void 0 ? void 0 : _c.vote_average) === 'number' ? args.item.vote_average : null;
    const imdbRating = typeof ((_d = args.item) === null || _d === void 0 ? void 0 : _d.imdbRating) === 'number' ? args.item.imdbRating : null;
    const titleLower = normalizeTitle(args.item).toLowerCase().slice(0, 200);
    if (!existing) {
        const agg = {
            titleKey: args.titleKey,
            mediaType: args.mediaType,
            status: args.sourceStatus,
            listIds: new Set(args.listId ? [args.listId] : []),
            userRating: typeof ((_e = args.item) === null || _e === void 0 ? void 0 : _e.user_rating) === 'number' ? args.item.user_rating : null,
            addedAt,
            updatedAt: now,
            lastWatchedAt: args.watchedAt || null,
            sort: {
                imdbRating,
                tmdbRating,
                popularity: typeof ((_f = args.item) === null || _f === void 0 ? void 0 : _f.popularity) === 'number' ? args.item.popularity : null,
                year: computeYear(args.item),
                titleLower,
            },
        };
        libraryByTitle.set(args.titleKey, agg);
        return;
    }
    if (args.listId)
        existing.listIds.add(args.listId);
    if (statusPriority(args.sourceStatus) > statusPriority(existing.status)) {
        existing.status = args.sourceStatus;
    }
    if (args.watchedAt && (!existing.lastWatchedAt || args.watchedAt.toMillis() > existing.lastWatchedAt.toMillis())) {
        existing.lastWatchedAt = args.watchedAt;
    }
    if (addedAt.toMillis() < existing.addedAt.toMillis()) {
        existing.addedAt = addedAt;
    }
    existing.updatedAt = now;
}
exports.upsertLibraryAggregate = upsertLibraryAggregate;
async function ensureEpisodeMapForTitle(db, cache, titleKey, onFailure) {
    const cached = cache.get(titleKey);
    if (cached)
        return cached;
    const map = new Map();
    try {
        const snap = await db.collection('catalog_titles').doc(titleKey).collection('episodes').get();
        for (const doc of snap.docs) {
            const d = doc.data() || {};
            const s = Number(d.seasonNumber);
            const e = Number(d.episodeNumber);
            const a = Number(d.absoluteOrder);
            if (!Number.isInteger(s) || !Number.isInteger(e) || !Number.isFinite(a))
                continue;
            map.set(`${s}:${e}`, { absoluteOrder: a });
        }
    }
    catch (err) {
        onFailure({ stage: 'catalog_lookup', id: titleKey, error: String((err === null || err === void 0 ? void 0 : err.message) || err) });
    }
    cache.set(titleKey, map);
    return map;
}
exports.ensureEpisodeMapForTitle = ensureEpisodeMapForTitle;
function buildEpisodeStateDocId(titleKey, seasonNumber, episodeNumber) {
    const s = String(seasonNumber).padStart(2, '0');
    const e = String(episodeNumber).padStart(2, '0');
    return `${titleKey}_s${s}e${e}`;
}
exports.buildEpisodeStateDocId = buildEpisodeStateDocId;
function buildListItemWrite(userRef, listId, itemKey, item, titleKey, mediaType, now) {
    const addedAt = toTimestamp((item === null || item === void 0 ? void 0 : item.dateAdded) || (item === null || item === void 0 ? void 0 : item.addedAt) || now);
    const displayTitle = normalizeTitle(item).slice(0, 200) || titleKey;
    return {
        ref: userRef.collection('lists').doc(listId).collection('items').doc(itemKey),
        data: {
            titleKey,
            mediaType,
            addedAt,
            position: Number(item === null || item === void 0 ? void 0 : item.position) || addedAt.toMillis(),
            sort: {
                imdbRating: typeof (item === null || item === void 0 ? void 0 : item.imdbRating) === 'number' ? item.imdbRating : null,
                tmdbRating: typeof (item === null || item === void 0 ? void 0 : item.vote_average) === 'number' ? item.vote_average : null,
                popularity: typeof (item === null || item === void 0 ? void 0 : item.popularity) === 'number' ? item.popularity : null,
                year: computeYear(item),
                titleLower: displayTitle.toLowerCase(),
            },
            display: {
                title: displayTitle,
                posterPath: (item === null || item === void 0 ? void 0 : item.poster_path) || null,
                releaseDate: (item === null || item === void 0 ? void 0 : item.release_date) || (item === null || item === void 0 ? void 0 : item.first_air_date) || null,
            },
        },
        merge: true,
    };
}
exports.buildListItemWrite = buildListItemWrite;
async function commitWritesInChunks(db, writes, onFailure, chunkSize = 450) {
    for (let i = 0; i < writes.length; i += chunkSize) {
        const chunk = writes.slice(i, i + chunkSize);
        const batch = db.batch();
        for (const w of chunk) {
            if (w.merge) {
                batch.set(w.ref, w.data, { merge: true });
            }
            else {
                batch.set(w.ref, w.data);
            }
        }
        try {
            await batch.commit();
        }
        catch (err) {
            onFailure({ stage: 'batch_commit', error: String((err === null || err === void 0 ? void 0 : err.message) || err) });
        }
    }
}
exports.commitWritesInChunks = commitWritesInChunks;
//# sourceMappingURL=migrationBackfill.js.map