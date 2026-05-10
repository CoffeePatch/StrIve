"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enrichItem = exports.fetchImdbRatings = exports.getImdbApiBaseUrl = exports.fetchTmdbDetails = exports.fetchTmdbExternalIds = void 0;
const net_1 = require("../utils/net");
async function fetchTmdbExternalIds(mediaType, tmdbId, apiKey) {
    if (!apiKey)
        return null;
    const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${apiKey}`;
    try {
        const res = await (0, net_1.fetchWithTimeout)(url, {}, 8000);
        if (!res.ok)
            return null;
        return await res.json();
    }
    catch (_a) {
        return null;
    }
}
exports.fetchTmdbExternalIds = fetchTmdbExternalIds;
async function fetchTmdbDetails(mediaType, tmdbId, apiKey) {
    if (!apiKey)
        return null;
    const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${apiKey}`;
    try {
        const res = await (0, net_1.fetchWithTimeout)(url, {}, 8000);
        if (!res.ok)
            return null;
        return await res.json();
    }
    catch (_a) {
        return null;
    }
}
exports.fetchTmdbDetails = fetchTmdbDetails;
function getImdbApiBaseUrl() {
    const baseUrl = process.env.IMDB_API_BASE_URL;
    if (!baseUrl) {
        const errorMsg = 'IMDB_API_BASE_URL environment variable is not configured. IMDb ratings will be unavailable.';
        console.error(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
    }
    return baseUrl.replace(/\/$/, '');
}
exports.getImdbApiBaseUrl = getImdbApiBaseUrl;
async function fetchImdbRatings(imdbId) {
    var _a, _b, _c, _d, _e;
    if (!imdbId)
        return null;
    try {
        const base = getImdbApiBaseUrl();
        const url = `${base}/titles/${imdbId}`;
        const res = await (0, net_1.fetchWithTimeout)(url, {}, 8000);
        if (!res.ok)
            return null;
        const data = await res.json();
        const rating = (_c = (_a = data === null || data === void 0 ? void 0 : data.rating) !== null && _a !== void 0 ? _a : (_b = data === null || data === void 0 ? void 0 : data.ratings) === null || _b === void 0 ? void 0 : _b.imdb) !== null && _c !== void 0 ? _c : data === null || data === void 0 ? void 0 : data.ratingAverage;
        const votes = (_e = (_d = data === null || data === void 0 ? void 0 : data.votes) !== null && _d !== void 0 ? _d : data === null || data === void 0 ? void 0 : data.ratingsCount) !== null && _e !== void 0 ? _e : data === null || data === void 0 ? void 0 : data.imdbVotes;
        return {
            rating: typeof rating === 'number' ? rating : (typeof rating === 'string' ? parseFloat(rating) : undefined),
            votes: typeof votes === 'number' ? votes : (typeof votes === 'string' ? parseInt(votes.replace(/[,]/g, ''), 10) : undefined),
        };
    }
    catch (err) {
        if (err instanceof Error && err.message.includes('IMDB_API_BASE_URL')) {
            console.warn('IMDb ratings unavailable - IMDB_API_BASE_URL not configured');
            return null;
        }
        console.error(`fetchImdbRatings error for ${imdbId}:`, err);
        return null;
    }
}
exports.fetchImdbRatings = fetchImdbRatings;
function deriveMediaType(item) {
    if ((item === null || item === void 0 ? void 0 : item.media_type) === 'tv')
        return 'tv';
    if ((item === null || item === void 0 ? void 0 : item.media_type) === 'movie')
        return 'movie';
    if (item === null || item === void 0 ? void 0 : item.first_air_date)
        return 'tv';
    return 'movie';
}
function deriveName(item, mediaType) {
    return mediaType === 'movie' ? ((item === null || item === void 0 ? void 0 : item.title) || (item === null || item === void 0 ? void 0 : item.name) || '') : ((item === null || item === void 0 ? void 0 : item.name) || (item === null || item === void 0 ? void 0 : item.title) || '');
}
function deriveYear(item, mediaType) {
    const dateStr = mediaType === 'movie' ? ((item === null || item === void 0 ? void 0 : item.release_date) || (item === null || item === void 0 ? void 0 : item.first_air_date)) : ((item === null || item === void 0 ? void 0 : item.first_air_date) || (item === null || item === void 0 ? void 0 : item.release_date));
    if (!dateStr)
        return '';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '' : String(d.getUTCFullYear());
}
async function enrichItem(item, tmdbApiKey) {
    var _a, _b;
    const tmdbId = (_b = (_a = item === null || item === void 0 ? void 0 : item.id) !== null && _a !== void 0 ? _a : item === null || item === void 0 ? void 0 : item.tmdbId) !== null && _b !== void 0 ? _b : item === null || item === void 0 ? void 0 : item.tmdb_id;
    const mediaType = deriveMediaType(item);
    const name = deriveName(item, mediaType);
    const year = deriveYear(item, mediaType);
    let imdbId = '';
    let tmdbRating = '';
    let tmdbVotes = '';
    let imdbRating = '';
    let imdbVotes = '';
    const [ext, details] = await Promise.all([
        fetchTmdbExternalIds(mediaType, tmdbId, tmdbApiKey),
        fetchTmdbDetails(mediaType, tmdbId, tmdbApiKey),
    ]);
    if (ext === null || ext === void 0 ? void 0 : ext.imdb_id)
        imdbId = ext.imdb_id;
    if (details) {
        const va = details.vote_average;
        const vc = details.vote_count;
        if (typeof va === 'number')
            tmdbRating = va.toFixed(1).replace(/\.0$/, '.0');
        if (typeof vc === 'number')
            tmdbVotes = String(vc);
    }
    if (!tmdbRating && typeof (item === null || item === void 0 ? void 0 : item.vote_average) === 'number') {
        tmdbRating = item.vote_average.toFixed(1).replace(/\.0$/, '.0');
    }
    if (!tmdbVotes && typeof (item === null || item === void 0 ? void 0 : item.vote_count) === 'number') {
        tmdbVotes = String(item.vote_count);
    }
    if (imdbId) {
        const imdb = await fetchImdbRatings(imdbId);
        if (imdb) {
            if (typeof imdb.rating === 'number')
                imdbRating = imdb.rating.toFixed(1).replace(/\.0$/, '.0');
            if (typeof imdb.votes === 'number')
                imdbVotes = String(imdb.votes);
        }
    }
    return { tmdbId, imdbId, name, year, mediaType, tmdbRating, imdbRating, tmdbVotes, imdbVotes };
}
exports.enrichItem = enrichItem;
//# sourceMappingURL=enrichment.js.map