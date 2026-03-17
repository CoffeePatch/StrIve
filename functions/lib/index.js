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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runPhase2BackfillMigration = exports.recomputeSeriesProgress = exports.onEpisodeStateWritten = exports.markEpisodeWatched = exports.enrichList = exports.getTvVideos = exports.getTvSeasonEpisodes = exports.getTvSeasons = exports.getTvDetails = exports.confirmListImport = exports.analyzeListImport = exports.listsExport = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const Papa = __importStar(require("papaparse"));
const busboy_1 = __importDefault(require("busboy"));
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const firestore_2 = require("firebase-functions/v2/firestore");
// Initialize the Firebase Admin SDK
if (!admin.apps.length) {
    admin.initializeApp();
}
// Firestore instance (used in some legacy paths, kept for compatibility)
// const db = admin.firestore();
// Helper function to escape CSV fields that might contain commas, quotes, or newlines
function escapeCsvField(field) {
    if (field === null || field === undefined) {
        return '';
    }
    const fieldStr = String(field);
    if (fieldStr.includes(',') || fieldStr.includes('"') || fieldStr.includes('\n')) {
        return `"${fieldStr.replace(/"/g, '""')}"`;
    }
    return fieldStr;
}
// Helper: simple timeout wrapper for fetch
async function fetchWithTimeout(resource, options = {}, timeoutMs = 8000) {
    const f = globalThis.fetch;
    return await Promise.race([
        f(resource, options || {}),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs))
    ]);
}
// Helper: modest concurrency limiter
function pLimit(concurrency) {
    let activeCount = 0;
    const queue = [];
    const next = () => {
        activeCount--;
        if (queue.length > 0)
            queue.shift()();
    };
    const run = async (fn) => {
        if (activeCount >= concurrency) {
            await new Promise(resolve => queue.push(resolve));
        }
        activeCount++;
        try {
            return await fn();
        }
        finally {
            next();
        }
    };
    return run;
}
// Helper to traverse mocked Firestore layers used in tests and real Firestore
function walkLayer(layer, segments) {
    let cur = layer;
    for (const seg of segments) {
        // Unwrap one level if cur is a function returning the next callable
        if (typeof cur === 'function')
            cur = cur();
        if (typeof cur === 'function') {
            cur = cur(seg);
            continue;
        }
        if (cur && typeof cur.collection === 'function') {
            cur = cur.collection(seg);
            continue;
        }
        if (cur && typeof cur.doc === 'function') {
            cur = cur.doc(seg);
            continue;
        }
    }
    if (typeof cur === 'function')
        cur = cur();
    return cur;
}
async function fetchTmdbExternalIds(mediaType, tmdbId, apiKey) {
    if (!apiKey)
        return null;
    const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${apiKey}`;
    try {
        const res = await fetchWithTimeout(url, {}, 8000);
        if (!res.ok)
            return null;
        return await res.json();
    }
    catch (_a) {
        return null;
    }
}
async function fetchTmdbDetails(mediaType, tmdbId, apiKey) {
    if (!apiKey)
        return null;
    const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${apiKey}`;
    try {
        const res = await fetchWithTimeout(url, {}, 8000);
        if (!res.ok)
            return null;
        return await res.json();
    }
    catch (_a) {
        return null;
    }
}
/**
 * Configuration accessor for IMDb API base URL.
 * Required for IMDb rating lookups during CSV export.
 *
 * DEVNOTE: Set IMDB_API_BASE_URL in your environment:
 * - Local: Add to .env or .runtimeconfig.json
 * - Staging/Prod: Use Firebase Functions config or Cloud Console
 * - Example: firebase functions:config:set imdb.api_base_url="https://api.imdbapi.dev"
 *
 * @returns {string} The IMDb API base URL
 * @throws {Error} If IMDB_API_BASE_URL is not configured
 */
function getImdbApiBaseUrl() {
    const baseUrl = process.env.IMDB_API_BASE_URL;
    if (!baseUrl) {
        const errorMsg = 'IMDB_API_BASE_URL environment variable is not configured. IMDb ratings will be unavailable.';
        console.error(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
    }
    return baseUrl.replace(/\/$/, ''); // Remove trailing slash
}
async function fetchImdbRatings(imdbId) {
    var _a, _b, _c, _d, _e;
    if (!imdbId)
        return null;
    try {
        const base = getImdbApiBaseUrl();
        const url = `${base}/titles/${imdbId}`;
        const res = await fetchWithTimeout(url, {}, 8000);
        if (!res.ok)
            return null;
        const data = await res.json();
        const rating = (_c = (_a = data === null || data === void 0 ? void 0 : data.rating) !== null && _a !== void 0 ? _a : (_b = data === null || data === void 0 ? void 0 : data.ratings) === null || _b === void 0 ? void 0 : _b.imdb) !== null && _c !== void 0 ? _c : data === null || data === void 0 ? void 0 : data.ratingAverage;
        const votes = (_e = (_d = data === null || data === void 0 ? void 0 : data.votes) !== null && _d !== void 0 ? _d : data === null || data === void 0 ? void 0 : data.ratingsCount) !== null && _e !== void 0 ? _e : data === null || data === void 0 ? void 0 : data.imdbVotes;
        return {
            rating: typeof rating === 'number' ? rating : (typeof rating === 'string' ? parseFloat(rating) : undefined),
            votes: typeof votes === 'number' ? votes : (typeof votes === 'string' ? parseInt(votes.replace(/[,]/g, ''), 10) : undefined)
        };
    }
    catch (err) {
        // If IMDB_API_BASE_URL not configured, log once and return null (graceful degradation)
        if (err instanceof Error && err.message.includes('IMDB_API_BASE_URL')) {
            console.warn('IMDb ratings unavailable - IMDB_API_BASE_URL not configured');
            return null;
        }
        console.error(`fetchImdbRatings error for ${imdbId}:`, err);
        return null;
    }
}
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
        fetchTmdbDetails(mediaType, tmdbId, tmdbApiKey)
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
    // Fallback to fields present on the item if TMDB fetch not available
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
// Unified export endpoint: GET /lists/{listId}/export, supports custom lists and 'watchlist'
exports.listsExport = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    const pathParts = req.path.split('/').filter(Boolean);
    const listsIndex = pathParts.indexOf('lists');
    const exportIndex = pathParts.indexOf('export');
    if (listsIndex === -1 || exportIndex === -1 || exportIndex !== listsIndex + 2) {
        res.status(400).json({ error: 'Invalid URL path. Expected /lists/{listId}/export' });
        return;
    }
    const listId = pathParts[listsIndex + 1];
    if (!listId) {
        res.status(400).json({ error: 'List ID is required' });
        return;
    }
    const authHeader = req.headers.authorization || req.headers.Authorization;
    if (!authHeader || !String(authHeader).startsWith('Bearer ')) {
        res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
        return;
    }
    const token = String(authHeader).substring(7);
    let decodedToken;
    try {
        decodedToken = await admin.auth().verifyIdToken(token);
    }
    catch (_a) {
        res.status(401).json({ error: 'Unauthorized: Invalid token' });
        return;
    }
    const uid = decodedToken.uid;
    let itemsSnapshot = null;
    let listName = 'Watchlist';
    const dbi = admin.firestore();
    const users = dbi.collection ? dbi.collection('users') : dbi;
    if (listId === 'watchlist') {
        const wlColl = walkLayer(users, [uid, 'watchlist']);
        itemsSnapshot = await wlColl.get();
    }
    else {
        const listRef = walkLayer(users, [uid, 'custom_lists', listId]);
        const listDoc = await listRef.get();
        if (!listDoc.exists) {
            res.status(404).json({ error: 'List not found' });
            return;
        }
        const data = listDoc.data();
        if (!data || data.ownerId !== uid) {
            res.status(403).json({ error: 'Forbidden: You do not have permission to access this list' });
            return;
        }
        listName = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : listId;
        const itemsColl = listRef.collection ? listRef.collection('items') : walkLayer(listRef, ['items']);
        itemsSnapshot = await itemsColl.get();
    }
    if (!itemsSnapshot || itemsSnapshot.empty) {
        res.set('Cache-Control', 'no-cache');
        res.status(204).end();
        return;
    }
    const tmdbApiKey = process.env.TMDB_API_KEY;
    const limit = pLimit(8);
    const enriched = await Promise.all(itemsSnapshot.docs.map((d) => d.data()).map((item) => limit(() => enrichItem(item, tmdbApiKey))));
    // CSV header per contract
    const header = 'tmdbId,imdbId,name,year,mediaType,tmdbRating,imdbRating,tmdbVotes,imdbVotes';
    const rows = enriched.map(r => {
        var _a;
        return [
            escapeCsvField(String((_a = r.tmdbId) !== null && _a !== void 0 ? _a : '')),
            escapeCsvField(r.imdbId || ''),
            escapeCsvField(r.name || ''),
            escapeCsvField(r.year || ''),
            escapeCsvField(r.mediaType || ''),
            escapeCsvField(r.tmdbRating || ''),
            escapeCsvField(r.imdbRating || ''),
            escapeCsvField(r.tmdbVotes || ''),
            escapeCsvField(r.imdbVotes || '')
        ].join(',');
    });
    const csv = [header, ...rows].join('\n');
    // Headers
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    const dateStr = `${y}${m}${d}`;
    const safeName = (listId === 'watchlist' ? 'Watchlist' : listName).replace(/[\n\r]/g, ' ').trim();
    const filename = `${safeName}-${dateStr}.csv`;
    res.set('Content-Type', 'text/csv');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.set('Cache-Control', 'no-cache');
    res.status(200).send(csv);
    return;
});
/**
 * Analyzes a CSV file for import to a user's movie list
 * Route: POST /lists/{listId}/import/analyze
 * Enforces new CSV schema: tmdbId,imdbId,name,year,mediaType,tmdbRating,imdbRating,tmdbVotes,imdbVotes
 */
exports.analyzeListImport = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const pathParts = req.path.split('/').filter(Boolean);
        const listsIndex = pathParts.indexOf('lists');
        const importIndex = pathParts.indexOf('import');
        const analyzeIndex = pathParts.indexOf('analyze');
        if (listsIndex === -1 || importIndex === -1 || analyzeIndex === -1 || analyzeIndex !== importIndex + 1 || listsIndex + 1 >= pathParts.length) {
            res.status(400).json({ error: 'Invalid URL path. Expected /lists/{listId}/import/analyze' });
            return;
        }
        const listId = pathParts[listsIndex + 1];
        const authHeader = req.headers.authorization;
        if (!authHeader || !String(authHeader).startsWith('Bearer ')) {
            res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
            return;
        }
        const token = String(authHeader).substring(7);
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(token);
        }
        catch (_a) {
            res.status(401).json({ error: 'Unauthorized: Invalid token' });
            return;
        }
        const uid = decodedToken.uid;
        let itemsCollectionRef;
        if (listId === 'watchlist') {
            itemsCollectionRef = admin.firestore().collection('users').doc(uid).collection('watchlist');
        }
        else {
            const listRef = admin.firestore().collection('users').doc(uid).collection('custom_lists').doc(listId);
            const listDoc = await listRef.get();
            if (!listDoc.exists) {
                res.status(404).json({ error: 'List not found' });
                return;
            }
            const listData = listDoc.data();
            if (!listData || listData.ownerId !== uid) {
                res.status(403).json({ error: 'Forbidden: You do not have permission to access this list' });
                return;
            }
            itemsCollectionRef = listRef.collection('items');
        }
        const contentType = (req.headers['content-type'] || req.headers['Content-Type']);
        if (!contentType || !contentType.includes('multipart/form-data')) {
            res.status(400).json({ error: 'Content-Type must be multipart/form-data' });
            return;
        }
        const EXPECTED_HEADERS = ['tmdbId', 'imdbId', 'name', 'year', 'mediaType', 'tmdbRating', 'imdbRating', 'tmdbVotes', 'imdbVotes'];
        const busboy = (0, busboy_1.default)({ headers: req.headers });
        let csvBuffer = null;
        let fileCount = 0;
        busboy.on('file', (_fieldname, file, info) => {
            const { filename, mimeType } = info;
            if (mimeType === 'text/csv' || (filename && filename.endsWith('.csv'))) {
                fileCount++;
                const buffers = [];
                file.on('data', (data) => buffers.push(data));
                file.on('end', () => { csvBuffer = Buffer.concat(buffers); });
            }
            else {
                file.resume();
            }
        });
        busboy.on('finish', async () => {
            var _a;
            if (!csvBuffer || fileCount !== 1) {
                res.status(400).json({ error: 'Exactly one CSV file is required' });
                return;
            }
            try {
                const csvString = csvBuffer.toString('utf8');
                const parsed = Papa.parse(csvString, { header: true, skipEmptyLines: true });
                const fields = ((_a = parsed === null || parsed === void 0 ? void 0 : parsed.meta) === null || _a === void 0 ? void 0 : _a.fields) || [];
                if (fields.length !== EXPECTED_HEADERS.length || !fields.every((f, i) => f === EXPECTED_HEADERS[i])) {
                    if (fields.includes('Letterboxd URI') || fields.includes('Name') || (fields.includes('Year') && !fields.includes('year'))) {
                        res.status(400).json({ error: 'Legacy CSV headers detected. Expected: ' + EXPECTED_HEADERS.join(',') });
                        return;
                    }
                    res.status(400).json({ error: 'Invalid CSV headers. Expected exact columns: ' + EXPECTED_HEADERS.join(',') });
                    return;
                }
                const existingSnapshot = await itemsCollectionRef.get();
                const existingById = new Map();
                const existingByNameYear = new Set();
                existingSnapshot.docs.forEach((d) => {
                    const it = d.data();
                    if (it === null || it === void 0 ? void 0 : it.id)
                        existingById.set(String(it.id), it);
                    const n = ((it === null || it === void 0 ? void 0 : it.title) || (it === null || it === void 0 ? void 0 : it.name) || '').trim();
                    const y = ((it === null || it === void 0 ? void 0 : it.release_date) || (it === null || it === void 0 ? void 0 : it.first_air_date) || '').slice(0, 4);
                    if (n && y)
                        existingByNameYear.add(`${n}::${y}`);
                });
                const tmdbApiKey = process.env.TMDB_API_KEY;
                const limit = pLimit(6);
                async function tmdbFindByImdb(imdbId, mt) {
                    if (!tmdbApiKey || !imdbId)
                        return null;
                    const url = `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?api_key=${tmdbApiKey}&external_source=imdb_id`;
                    try {
                        const r = await fetchWithTimeout(url, {}, 8000);
                        if (!r.ok)
                            return null;
                        const j = await r.json();
                        const arr = mt === 'movie' ? j === null || j === void 0 ? void 0 : j.movie_results : j === null || j === void 0 ? void 0 : j.tv_results;
                        return Array.isArray(arr) && arr[0] ? arr[0] : null;
                    }
                    catch (_a) {
                        return null;
                    }
                }
                async function tmdbSearchByNameYear(name, year, mt) {
                    if (!tmdbApiKey || !name)
                        return null;
                    const base = `https://api.themoviedb.org/3/search/${mt}`;
                    const q = new URLSearchParams({ api_key: String(tmdbApiKey), query: name });
                    if (year)
                        q.set(mt === 'movie' ? 'year' : 'first_air_date_year', year);
                    const url = `${base}?${q.toString()}`;
                    try {
                        const r = await fetchWithTimeout(url, {}, 8000);
                        if (!r.ok)
                            return null;
                        const j = await r.json();
                        return Array.isArray(j === null || j === void 0 ? void 0 : j.results) && j.results[0] ? j.results[0] : null;
                    }
                    catch (_a) {
                        return null;
                    }
                }
                async function tmdbDetails(mt, id) {
                    if (!tmdbApiKey || !id)
                        return null;
                    const url = `https://api.themoviedb.org/3/${mt}/${id}?api_key=${tmdbApiKey}`;
                    try {
                        const r = await fetchWithTimeout(url, {}, 8000);
                        if (!r.ok)
                            return null;
                        return await r.json();
                    }
                    catch (_a) {
                        return null;
                    }
                }
                const rows = parsed.data;
                const result = { matched: [], unmatched: [], duplicates: [] };
                await Promise.all(rows.map((row) => limit(async () => {
                    const tmdbIdRaw = String(row.tmdbId || '').trim();
                    const imdbIdRaw = String(row.imdbId || '').trim();
                    const name = String(row.name || '').trim();
                    const year = String(row.year || '').trim();
                    const mt = (String(row.mediaType || '').trim() === 'tv') ? 'tv' : 'movie';
                    if (tmdbIdRaw && existingById.has(tmdbIdRaw)) {
                        const it = existingById.get(tmdbIdRaw);
                        result.duplicates.push({ movie: { id: it.id, title: it.title || it.name, release_date: it.release_date, first_air_date: it.first_air_date, media_type: it.media_type, poster_path: it.poster_path }, originalRow: row });
                        return;
                    }
                    if (!tmdbIdRaw && name && year && existingByNameYear.has(`${name}::${year}`)) {
                        const it = [...existingById.values()].find((v) => (v.title || v.name) === name && (v.release_date || v.first_air_date || '').startsWith(year));
                        if (it) {
                            result.duplicates.push({ movie: { id: it.id, title: it.title || it.name, release_date: it.release_date, first_air_date: it.first_air_date, media_type: it.media_type, poster_path: it.poster_path }, originalRow: row });
                            return;
                        }
                    }
                    let resolved = null;
                    if (tmdbIdRaw) {
                        resolved = await tmdbDetails(mt, tmdbIdRaw);
                    }
                    else if (imdbIdRaw) {
                        const found = await tmdbFindByImdb(imdbIdRaw, mt);
                        if (found === null || found === void 0 ? void 0 : found.id)
                            resolved = await tmdbDetails(mt, found.id);
                    }
                    else if (name) {
                        const found = await tmdbSearchByNameYear(name, year, mt);
                        if (found === null || found === void 0 ? void 0 : found.id)
                            resolved = await tmdbDetails(mt, found.id);
                    }
                    if (resolved === null || resolved === void 0 ? void 0 : resolved.id) {
                        result.matched.push({ movie: { id: resolved.id, title: resolved.title || resolved.name, release_date: resolved.release_date, first_air_date: resolved.first_air_date, media_type: mt, poster_path: resolved.poster_path }, originalRow: row });
                    }
                    else {
                        result.unmatched.push({ row, reason: 'Not found in TMDB' });
                    }
                })));
                res.status(200).json(result);
                return;
            }
            catch (parseError) {
                console.error('Error parsing CSV:', parseError);
                res.status(400).json({ error: 'Invalid CSV format' });
                return;
            }
        });
        req.pipe(busboy);
    }
    catch (error) {
        console.error('Error analyzing CSV for import:', error);
        res.status(500).json({ error: 'Internal server error' });
        return;
    }
});
/**
 * Confirms the import of selected movies to a user's movie list
 * Route: POST /lists/{listId}/import/confirm
 * Fetches real TMDB details and writes to Firestore with idempotency
 */
exports.confirmListImport = functions.https.onRequest(async (req, res) => {
    var _a;
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const pathParts = req.path.split('/').filter(Boolean);
        const listsIndex = pathParts.indexOf('lists');
        const importIndex = pathParts.indexOf('import');
        const confirmIndex = pathParts.indexOf('confirm');
        if (listsIndex === -1 || importIndex === -1 || confirmIndex === -1 || confirmIndex !== importIndex + 1 || listsIndex + 1 >= pathParts.length) {
            res.status(400).json({ error: 'Invalid URL path. Expected /lists/{listId}/import/confirm' });
            return;
        }
        const listId = pathParts[listsIndex + 1];
        const authHeader = req.headers.authorization;
        if (!authHeader || !String(authHeader).startsWith('Bearer ')) {
            res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
            return;
        }
        const token = String(authHeader).substring(7);
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(token);
        }
        catch (_b) {
            res.status(401).json({ error: 'Unauthorized: Invalid token' });
            return;
        }
        const uid = decodedToken.uid;
        let itemsCollectionRef;
        if (listId === 'watchlist') {
            itemsCollectionRef = admin.firestore().collection('users').doc(uid).collection('watchlist');
        }
        else {
            const listRef = admin.firestore().collection('users').doc(uid).collection('custom_lists').doc(listId);
            const listDoc = await listRef.get();
            if (!listDoc.exists) {
                res.status(404).json({ error: 'List not found' });
                return;
            }
            const data = listDoc.data();
            if (!data || data.ownerId !== uid) {
                res.status(403).json({ error: 'Forbidden: You do not have permission to access this list' });
                return;
            }
            itemsCollectionRef = listRef.collection('items');
        }
        const { moviesToImport } = req.body || {};
        if (!Array.isArray(moviesToImport)) {
            res.status(400).json({ error: 'Request body must contain an array of moviesToImport' });
            return;
        }
        if (moviesToImport.length === 0) {
            res.status(201).json({ success: true, moviesAdded: 0, message: 'No movies to import' });
            return;
        }
        const existingSnapshot = await itemsCollectionRef.get();
        const existing = new Set(existingSnapshot.docs.map((d) => String((d.data() || {}).id)));
        const tmdbApiKey = process.env.TMDB_API_KEY;
        async function fetchDetailsTryBoth(id) {
            if (!tmdbApiKey)
                return { ok: false };
            const mUrl = `https://api.themoviedb.org/3/movie/${id}?api_key=${tmdbApiKey}`;
            const tUrl = `https://api.themoviedb.org/3/tv/${id}?api_key=${tmdbApiKey}`;
            try {
                const r = await fetchWithTimeout(mUrl, {}, 8000);
                if (r.ok) {
                    const j = await r.json();
                    return { ok: true, data: j, media_type: 'movie' };
                }
            }
            catch (_a) { }
            try {
                const r = await fetchWithTimeout(tUrl, {}, 8000);
                if (r.ok) {
                    const j = await r.json();
                    return { ok: true, data: j, media_type: 'tv' };
                }
            }
            catch (_b) { }
            return { ok: false };
        }
        const batch = admin.firestore().batch();
        let moviesAdded = 0;
        for (const rawId of moviesToImport) {
            const id = String(rawId);
            if (existing.has(id))
                continue;
            const det = await fetchDetailsTryBoth(id);
            if (!det.ok || !((_a = det.data) === null || _a === void 0 ? void 0 : _a.id))
                continue;
            const payload = {
                id: det.data.id,
                title: det.data.title || det.data.name,
                poster_path: det.data.poster_path,
                release_date: det.data.release_date || det.data.first_air_date,
                vote_average: det.data.vote_average,
                media_type: det.media_type,
                dateAdded: admin.firestore.FieldValue.serverTimestamp(),
            };
            const docRef = itemsCollectionRef.doc(String(det.data.id));
            batch.set(docRef, payload, { merge: true });
            moviesAdded++;
        }
        if (moviesAdded > 0)
            await batch.commit();
        res.status(201).json({ success: true, moviesAdded, message: `${moviesAdded} items successfully added to the list` });
        return;
    }
    catch (error) {
        console.error('Error confirming list import:', error);
        res.status(500).json({ error: 'Internal server error' });
        return;
    }
});
// ==================== TV SHOW API PROXY ENDPOINTS ====================
// Simple in-memory cache for TV show data
const tvCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
function getCached(key) {
    const entry = tvCache.get(key);
    if (!entry)
        return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        tvCache.delete(key);
        return null;
    }
    return entry.data;
}
function setCache(key, data) {
    tvCache.set(key, { data, timestamp: Date.now() });
}
/**
 * GET /api/tv/:tvId
 * Fetches TV show details with optional IMDb enrichment
 */
exports.getTvDetails = functions.https.onRequest(async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g;
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    const tvId = req.path.split('/').pop();
    if (!tvId) {
        res.status(400).json({ error: 'TV ID is required' });
        return;
    }
    const cacheKey = `tv_details_${tvId}`;
    const cached = getCached(cacheKey);
    if (cached) {
        res.status(200).json(cached);
        return;
    }
    try {
        const tmdbApiKey = process.env.TMDB_API_KEY;
        if (!tmdbApiKey) {
            res.status(500).json({ error: 'TMDB API key not configured' });
            return;
        }
        const url = `https://api.themoviedb.org/3/tv/${tvId}?api_key=${tmdbApiKey}&append_to_response=external_ids,images&include_image_language=en,null`;
        const response = await fetchWithTimeout(url, {}, 15000);
        if (!response.ok) {
            res.status(response.status).json({ error: 'Failed to fetch TV show details' });
            return;
        }
        const data = await response.json();
        // Normalize to stable shape
        const normalized = {
            id: data.id,
            name: data.name,
            overview: data.overview,
            posterPath: data.poster_path,
            backdropPath: data.backdrop_path,
            firstAirDate: data.first_air_date,
            lastAirDate: data.last_air_date,
            status: data.status,
            numberOfSeasons: data.number_of_seasons,
            numberOfEpisodes: data.number_of_episodes,
            genres: ((_a = data.genres) === null || _a === void 0 ? void 0 : _a.map((g) => ({ id: g.id, name: g.name }))) || [],
            networks: ((_b = data.networks) === null || _b === void 0 ? void 0 : _b.map((n) => ({ id: n.id, name: n.name, logoPath: n.logo_path }))) || [],
            voteAverage: data.vote_average,
            voteCount: data.vote_count,
            logos: ((_d = (_c = data.images) === null || _c === void 0 ? void 0 : _c.logos) === null || _d === void 0 ? void 0 : _d.map((l) => ({ filePath: l.file_path, aspectRatio: l.aspect_ratio }))) || [],
            imdbId: ((_e = data.external_ids) === null || _e === void 0 ? void 0 : _e.imdb_id) || null,
        };
        // Optional IMDb enrichment
        if (normalized.imdbId) {
            try {
                const imdbBase = process.env.IMDB_API_BASE_URL;
                if (imdbBase) {
                    const imdbUrl = `${imdbBase.replace(/\/$/, '')}/titles/${normalized.imdbId}`;
                    const imdbRes = await fetchWithTimeout(imdbUrl, {}, 8000);
                    if (imdbRes.ok) {
                        const imdbData = await imdbRes.json();
                        normalized.imdbRating = ((_f = imdbData === null || imdbData === void 0 ? void 0 : imdbData.rating) === null || _f === void 0 ? void 0 : _f.aggregateRating) || (imdbData === null || imdbData === void 0 ? void 0 : imdbData.rating) || null;
                        normalized.imdbVotes = ((_g = imdbData === null || imdbData === void 0 ? void 0 : imdbData.rating) === null || _g === void 0 ? void 0 : _g.voteCount) || (imdbData === null || imdbData === void 0 ? void 0 : imdbData.votes) || null;
                    }
                }
            }
            catch (imdbError) {
                console.warn('IMDb fetch failed, continuing without IMDb data', imdbError);
            }
        }
        setCache(cacheKey, normalized);
        res.status(200).json(normalized);
    }
    catch (error) {
        console.error('Error fetching TV details:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * GET /api/tv/:tvId/seasons
 * Returns list of season metadata
 */
exports.getTvSeasons = functions.https.onRequest(async (req, res) => {
    var _a;
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    const pathParts = req.path.split('/').filter(Boolean);
    const tvId = pathParts[pathParts.length - 2];
    if (!tvId) {
        res.status(400).json({ error: 'TV ID is required' });
        return;
    }
    const cacheKey = `tv_seasons_${tvId}`;
    const cached = getCached(cacheKey);
    if (cached) {
        res.status(200).json(cached);
        return;
    }
    try {
        const tmdbApiKey = process.env.TMDB_API_KEY;
        if (!tmdbApiKey) {
            res.status(500).json({ error: 'TMDB API key not configured' });
            return;
        }
        const url = `https://api.themoviedb.org/3/tv/${tvId}?api_key=${tmdbApiKey}`;
        const response = await fetchWithTimeout(url, {}, 15000);
        if (!response.ok) {
            res.status(response.status).json({ error: 'Failed to fetch TV show' });
            return;
        }
        const data = await response.json();
        const seasons = ((_a = data.seasons) === null || _a === void 0 ? void 0 : _a.map((s) => ({
            id: s.id,
            name: s.name,
            seasonNumber: s.season_number,
            episodeCount: s.episode_count,
            airDate: s.air_date,
            posterPath: s.poster_path,
        }))) || [];
        setCache(cacheKey, seasons);
        res.status(200).json(seasons);
    }
    catch (error) {
        console.error('Error fetching TV seasons:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * GET /api/tv/:tvId/season/:seasonNumber
 * Returns episodes for a specific season
 */
exports.getTvSeasonEpisodes = functions.https.onRequest(async (req, res) => {
    var _a;
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    const pathParts = req.path.split('/').filter(Boolean);
    const tvId = pathParts[pathParts.length - 3];
    const seasonNumber = pathParts[pathParts.length - 1];
    if (!tvId || !seasonNumber) {
        res.status(400).json({ error: 'TV ID and season number are required' });
        return;
    }
    const cacheKey = `tv_season_${tvId}_${seasonNumber}`;
    const cached = getCached(cacheKey);
    if (cached) {
        res.status(200).json(cached);
        return;
    }
    try {
        const tmdbApiKey = process.env.TMDB_API_KEY;
        if (!tmdbApiKey) {
            res.status(500).json({ error: 'TMDB API key not configured' });
            return;
        }
        const url = `https://api.themoviedb.org/3/tv/${tvId}/season/${seasonNumber}?api_key=${tmdbApiKey}`;
        const response = await fetchWithTimeout(url, {}, 15000);
        if (!response.ok) {
            res.status(response.status).json({ error: 'Failed to fetch season episodes' });
            return;
        }
        const data = await response.json();
        const normalized = {
            seasonNumber: data.season_number,
            name: data.name,
            overview: data.overview,
            airDate: data.air_date,
            episodes: ((_a = data.episodes) === null || _a === void 0 ? void 0 : _a.map((ep) => ({
                id: ep.id,
                name: ep.name,
                episodeNumber: ep.episode_number,
                seasonNumber: ep.season_number,
                overview: ep.overview,
                stillPath: ep.still_path,
                airDate: ep.air_date,
                runtime: ep.runtime,
                voteAverage: ep.vote_average,
                voteCount: ep.vote_count,
            }))) || [],
        };
        setCache(cacheKey, normalized);
        res.status(200).json(normalized);
    }
    catch (error) {
        console.error('Error fetching season episodes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * GET /api/tv/:tvId/videos
 * Returns trailers and videos for a TV show
 */
exports.getTvVideos = functions.https.onRequest(async (req, res) => {
    var _a;
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    const pathParts = req.path.split('/').filter(Boolean);
    const tvId = pathParts[pathParts.length - 2];
    if (!tvId) {
        res.status(400).json({ error: 'TV ID is required' });
        return;
    }
    const cacheKey = `tv_videos_${tvId}`;
    const cached = getCached(cacheKey);
    if (cached) {
        res.status(200).json(cached);
        return;
    }
    try {
        const tmdbApiKey = process.env.TMDB_API_KEY;
        if (!tmdbApiKey) {
            res.status(500).json({ error: 'TMDB API key not configured' });
            return;
        }
        const url = `https://api.themoviedb.org/3/tv/${tvId}/videos?api_key=${tmdbApiKey}`;
        const response = await fetchWithTimeout(url, {}, 15000);
        if (!response.ok) {
            res.status(response.status).json({ error: 'Failed to fetch videos' });
            return;
        }
        const data = await response.json();
        const videos = ((_a = data.results) === null || _a === void 0 ? void 0 : _a.map((v) => ({
            id: v.id,
            key: v.key,
            name: v.name,
            site: v.site,
            type: v.type,
            official: v.official,
        }))) || [];
        setCache(cacheKey, videos);
        res.status(200).json(videos);
    }
    catch (error) {
        console.error('Error fetching videos:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Export all functions for Firebase to recognize them
/**
 * Background Enrichment Cloud Function
 * POST /lists/{listId}/enrich
 * Enriches all items in a list in the background (continues after user logs out)
 */
exports.enrichList = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const pathParts = req.path.split('/').filter(Boolean);
        const listsIndex = pathParts.indexOf('lists');
        const enrichIndex = pathParts.indexOf('enrich');
        if (listsIndex === -1 || enrichIndex === -1 || enrichIndex !== listsIndex + 2) {
            res.status(400).json({ error: 'Invalid URL path. Expected /lists/{listId}/enrich' });
            return;
        }
        const listId = pathParts[listsIndex + 1];
        // Verify auth
        const authHeader = req.headers.authorization;
        if (!authHeader || !String(authHeader).startsWith('Bearer ')) {
            res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
            return;
        }
        const token = String(authHeader).substring(7);
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(token);
        }
        catch (_a) {
            res.status(401).json({ error: 'Unauthorized: Invalid token' });
            return;
        }
        const uid = decodedToken.uid;
        // Get list reference
        let itemsCollectionRef;
        if (listId === 'watchlist') {
            itemsCollectionRef = admin.firestore().collection('users').doc(uid).collection('watchlist');
        }
        else {
            const listRef = admin.firestore().collection('users').doc(uid).collection('custom_lists').doc(listId);
            const listDoc = await listRef.get();
            if (!listDoc.exists) {
                res.status(404).json({ error: 'List not found' });
                return;
            }
            const data = listDoc.data();
            if (!data || data.ownerId !== uid) {
                res.status(403).json({ error: 'Forbidden: You do not have permission to access this list' });
                return;
            }
            itemsCollectionRef = listRef.collection('items');
        }
        // Immediately return success - enrichment will continue in background
        res.status(202).json({
            success: true,
            message: 'Enrichment started in background. Check back later for results.'
        });
        // Background enrichment (continues after response sent)
        const itemsSnapshot = await itemsCollectionRef.get();
        if (itemsSnapshot.empty)
            return;
        const tmdbApiKey = process.env.TMDB_API_KEY;
        const imdbApiBase = process.env.IMDB_API_BASE_URL;
        const limit = pLimit(3); // Conservative rate limiting
        await Promise.all(itemsSnapshot.docs.map((doc) => limit(async () => {
            const item = doc.data();
            // Skip if already enriched
            if (item.enrichmentStatus === 'enriched')
                return;
            const updates = {};
            let hasTmdbData = false;
            let hasImdbData = false;
            // Fetch TMDB data
            if (item.tmdbId) {
                try {
                    const mediaType = item.media_type === 'tv' ? 'tv' : 'movie';
                    const tmdbData = await fetchTmdbDetails(mediaType, item.tmdbId, tmdbApiKey);
                    if (tmdbData) {
                        hasTmdbData = true;
                        updates.tmdb_rating = tmdbData.vote_average || null;
                        updates.tmdb_vote_count = tmdbData.vote_count || null;
                        updates.overview = tmdbData.overview || null;
                        updates.backdrop_path = tmdbData.backdrop_path || null;
                        console.log(`✓ TMDB enriched: ${item.title} - Rating: ${updates.tmdb_rating}`);
                    }
                }
                catch (error) {
                    console.error(`TMDB fetch failed for ${item.title}:`, error);
                }
            }
            // Fetch IMDb data
            if (item.imdbId && imdbApiBase) {
                try {
                    const imdbData = await fetchImdbRatings(item.imdbId);
                    if (imdbData === null || imdbData === void 0 ? void 0 : imdbData.rating) {
                        hasImdbData = true;
                        updates.imdb_rating = imdbData.rating;
                        updates.imdb_vote_count = imdbData.votes || null;
                        console.log(`✓ IMDb enriched: ${item.title} - Rating: ${updates.imdb_rating}`);
                    }
                }
                catch (error) {
                    console.error(`IMDb fetch failed for ${item.title}:`, error);
                }
            }
            // Compute display rating (prioritize IMDb over TMDB)
            if (hasTmdbData || hasImdbData) {
                updates.vote_average = updates.imdb_rating || updates.tmdb_rating || null;
                updates.vote_count = updates.imdb_vote_count || updates.tmdb_vote_count || null;
                updates.enrichmentStatus = 'enriched';
                updates.lastEnriched = admin.firestore.FieldValue.serverTimestamp();
                await doc.ref.update(updates);
                console.log(`✓ Enriched ${item.title} successfully`);
            }
            else {
                await doc.ref.update({
                    enrichmentStatus: 'failed',
                    lastEnriched: admin.firestore.FieldValue.serverTimestamp(),
                });
                console.log(`✗ No data found for ${item.title}`);
            }
            // Throttle: Wait 2 seconds between items
            await new Promise(resolve => setTimeout(resolve, 2000));
        })));
        console.log(`✅ Enrichment complete for list ${listId}`);
    }
    catch (error) {
        console.error('Error in background enrichment:', error);
    }
});
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
    var _a, _b, _c, _d, _e;
    const uid = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication is required.');
    }
    const payload = (request.data || {});
    const titleKey = typeof payload.titleKey === 'string' ? payload.titleKey.trim() : '';
    const mode = payload.mode;
    const seasonNumber = Number(payload.seasonNumber);
    const episodeNumber = Number(payload.episodeNumber);
    const requestId = typeof payload.requestId === 'string' ? payload.requestId.trim() : '';
    const inputEpisodeCatalog = Array.isArray(payload.episodeCatalog) ? payload.episodeCatalog : [];
    if (!/^tmdb_tv_\d+$/.test(titleKey)) {
        throw new https_1.HttpsError('invalid-argument', 'titleKey must match tmdb_tv_<id>.');
    }
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
    const resolveExpiresAtMs = (rawValue) => {
        if (!rawValue)
            return 0;
        if (typeof rawValue === 'number')
            return Number.isFinite(rawValue) ? rawValue : 0;
        if (rawValue instanceof Date)
            return rawValue.getTime();
        if (typeof rawValue === 'string') {
            const parsed = Date.parse(rawValue);
            return Number.isFinite(parsed) ? parsed : 0;
        }
        const maybeTimestamp = rawValue;
        if (typeof maybeTimestamp.toMillis === 'function') {
            try {
                const v = maybeTimestamp.toMillis();
                return Number.isFinite(v) ? v : 0;
            }
            catch (_a) {
                return 0;
            }
        }
        if (typeof maybeTimestamp._seconds === 'number') {
            return (maybeTimestamp._seconds * 1000) + Math.floor((maybeTimestamp._nanoseconds || 0) / 1000000);
        }
        return 0;
    };
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
                const expiresAtMs = resolveExpiresAtMs(lockData.expiresAt);
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
        const allEpisodes = [];
        // Primary source: global catalog
        try {
            const titleSnap = await titleRef.get();
            const titleData = titleSnap.exists ? (titleSnap.data() || {}) : null;
            if (titleData && titleData.mediaType === 'tv') {
                const episodesSnap = await titleRef.collection('episodes').get();
                for (const doc of episodesSnap.docs) {
                    const d = doc.data() || {};
                    const sn = Number((_b = d.seasonNumber) !== null && _b !== void 0 ? _b : d.season_number);
                    const en = Number((_c = d.episodeNumber) !== null && _c !== void 0 ? _c : d.episode_number);
                    const ao = Number(d.absoluteOrder);
                    const isAired = d.isAired !== false;
                    if (!Number.isInteger(sn) || !Number.isInteger(en) || !Number.isFinite(ao)) {
                        continue;
                    }
                    allEpisodes.push({
                        seasonNumber: sn,
                        episodeNumber: en,
                        absoluteOrder: ao,
                        isAired,
                    });
                }
            }
        }
        catch (catalogErr) {
            console.warn('markEpisodeWatched catalog read failed; trying payload fallback:', catalogErr);
        }
        // Fallback source: client-provided episode catalog (from loaded season data)
        if (allEpisodes.length === 0 && inputEpisodeCatalog.length > 0) {
            for (let i = 0; i < inputEpisodeCatalog.length; i++) {
                const ep = inputEpisodeCatalog[i] || {};
                const sn = Number(ep.seasonNumber);
                const en = Number(ep.episodeNumber);
                const ao = Number((_e = (_d = ep.absoluteOrder) !== null && _d !== void 0 ? _d : (sn * 1000 + en)) !== null && _e !== void 0 ? _e : (i + 1));
                const isAired = ep.isAired !== false;
                if (!Number.isInteger(sn) || !Number.isInteger(en) || !Number.isFinite(ao)) {
                    continue;
                }
                allEpisodes.push({
                    seasonNumber: sn,
                    episodeNumber: en,
                    absoluteOrder: ao,
                    isAired,
                });
            }
        }
        if (allEpisodes.length === 0) {
            throw new https_1.HttpsError('failed-precondition', 'Episode metadata is unavailable. Seed catalog_titles episodes or pass episodeCatalog from client.');
        }
        const target = allEpisodes.find((e) => e.seasonNumber === seasonNumber && e.episodeNumber === episodeNumber);
        if (!target) {
            throw new https_1.HttpsError('not-found', `Target episode S${seasonNumber}E${episodeNumber} not found.`);
        }
        let selected = [];
        if (mode === 'single') {
            if (!target.isAired) {
                throw new https_1.HttpsError('failed-precondition', 'Target episode has not aired yet.');
            }
            selected = [target];
        }
        else if (mode === 'backfill_to_episode') {
            selected = allEpisodes
                .filter((e) => e.isAired && e.absoluteOrder <= target.absoluteOrder)
                .sort((a, b) => a.absoluteOrder - b.absoluteOrder);
        }
        else {
            selected = allEpisodes
                .filter((e) => e.isAired && e.seasonNumber === seasonNumber)
                .sort((a, b) => a.episodeNumber - b.episodeNumber);
        }
        if (selected.length === 0) {
            throw new https_1.HttpsError('failed-precondition', 'No eligible aired episodes matched this request.');
        }
        // Preload existing states so we can avoid unnecessary writes.
        const stateRefs = selected.map((e) => {
            const s = String(e.seasonNumber).padStart(2, '0');
            const ep = String(e.episodeNumber).padStart(2, '0');
            const stateId = `${titleKey}_s${s}e${ep}`;
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
            const MAX_BATCH_OPS = 500;
            for (let i = 0; i < writes.length; i += MAX_BATCH_OPS) {
                const chunk = writes.slice(i, i + MAX_BATCH_OPS);
                const batch = db.batch();
                for (const w of chunk) {
                    batch.set(w.ref, w.data, { merge: true });
                }
                await batch.commit();
            }
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
        if (err instanceof https_1.HttpsError) {
            throw err;
        }
        const errorCode = typeof (err === null || err === void 0 ? void 0 : err.code) === 'string' ? String(err.code).replace('functions/', '') : 'internal';
        const safeCode = ['invalid-argument', 'failed-precondition', 'not-found', 'aborted', 'already-exists', 'permission-denied', 'resource-exhausted', 'internal'].includes(errorCode)
            ? errorCode
            : 'internal';
        const safeMessage = typeof (err === null || err === void 0 ? void 0 : err.message) === 'string' && err.message.trim()
            ? err.message
            : 'Failed to mark episodes as watched.';
        throw new https_1.HttpsError(safeCode, safeMessage);
    }
});
/**
 * Trigger: materialize progress deltas whenever an episode state changes.
 * Path: users/{uid}/episode_states/{episodeStateKey}
 */
exports.onEpisodeStateWritten = (0, firestore_2.onDocumentWritten)('users/{uid}/episode_states/{episodeStateKey}', async (event) => {
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
    let totalEpisodesCount = 0;
    let airedEpisodesCount = 0;
    const catalogEpisodes = [];
    for (const doc of episodesSnap.docs) {
        const d = doc.data() || {};
        const seasonNumber = Number(d.seasonNumber);
        const episodeNumber = Number(d.episodeNumber);
        const absoluteOrder = Number(d.absoluteOrder);
        const isAired = !!d.isAired;
        if (!Number.isInteger(seasonNumber) || !Number.isInteger(episodeNumber) || !Number.isFinite(absoluteOrder)) {
            continue;
        }
        totalEpisodesCount++;
        if (isAired)
            airedEpisodesCount++;
        catalogEpisodes.push({ seasonNumber, episodeNumber, absoluteOrder, isAired });
    }
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
        tx.set(progressRef, {
            titleKey,
            watchedEpisodesCount: nextWatched,
            airedEpisodesCount,
            totalEpisodesCount,
            completionRatioAired,
            completionRatioTotal,
            lastWatchedEpisode,
            nextEpisode,
            progressNeedsRecompute,
            updatedAt: now,
        }, { merge: true });
        const existingStatus = typeof libraryData.status === 'string' ? libraryData.status : null;
        let nextStatus = existingStatus;
        if (nextWatched <= 0) {
            nextStatus = existingStatus === 'plan_to_watch' || existingStatus === 'dropped' ? existingStatus : null;
        }
        else if (airedEpisodesCount > 0 && nextWatched >= airedEpisodesCount) {
            nextStatus = 'completed';
        }
        else {
            nextStatus = 'watching';
        }
        tx.set(libraryRef, {
            titleKey,
            mediaType: 'tv',
            status: nextStatus,
            watchCounters: {
                watchedEpisodesCount: nextWatched,
                totalEpisodesCount,
                airedEpisodesCount,
                unAiredEpisodesCount: Math.max(0, totalEpisodesCount - airedEpisodesCount),
                completionRatio: completionRatioAired,
            },
            progressNeedsRecompute,
            lastWatchedAt: delta > 0 ? changedWatchedAt : libraryData.lastWatchedAt || null,
            updatedAt: now,
        }, { merge: true });
    });
});
/**
 * Callable: full rebuild of a user's series progress for one show.
 */
exports.recomputeSeriesProgress = (0, https_1.onCall)(async (request) => {
    var _a;
    const uid = (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid;
    if (!uid) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication is required.');
    }
    const payload = (request.data || {});
    const titleKey = typeof payload.titleKey === 'string' ? payload.titleKey.trim() : '';
    if (!/^tmdb_tv_\d+$/.test(titleKey)) {
        throw new https_1.HttpsError('invalid-argument', 'titleKey must match tmdb_tv_<id>.');
    }
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
    const catalogEpisodes = [];
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
        catalogEpisodes.push(ep);
        totalEpisodesCount++;
        if (isAired)
            airedEpisodesCount++;
    }
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
        let status = existingStatus;
        if (watchedAiredCount <= 0) {
            status = existingStatus === 'plan_to_watch' || existingStatus === 'dropped' ? existingStatus : null;
        }
        else if (airedEpisodesCount > 0 && watchedAiredCount >= airedEpisodesCount) {
            status = 'completed';
        }
        else {
            status = 'watching';
        }
        tx.set(progressRef, {
            titleKey,
            watchedEpisodesCount,
            airedEpisodesCount,
            totalEpisodesCount,
            completionRatioAired,
            completionRatioTotal,
            lastWatchedEpisode,
            nextEpisode,
            progressNeedsRecompute: false,
            updatedAt: now,
        }, { merge: true });
        tx.set(libraryRef, {
            titleKey,
            mediaType: 'tv',
            status,
            watchCounters: {
                watchedEpisodesCount,
                totalEpisodesCount,
                airedEpisodesCount,
                unAiredEpisodesCount: Math.max(0, totalEpisodesCount - airedEpisodesCount),
                completionRatio: completionRatioAired,
            },
            progressNeedsRecompute: false,
            lastWatchedAt: (lastWatchedEpisode === null || lastWatchedEpisode === void 0 ? void 0 : lastWatchedEpisode.watchedAt) || libraryData.lastWatchedAt || null,
            updatedAt: now,
        }, { merge: true });
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
    const toTimestamp = (v) => {
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
    };
    const detectMediaType = (item) => {
        if ((item === null || item === void 0 ? void 0 : item.media_type) === 'tv')
            return 'tv';
        if ((item === null || item === void 0 ? void 0 : item.media_type) === 'movie')
            return 'movie';
        if ((item === null || item === void 0 ? void 0 : item.first_air_date) || (item === null || item === void 0 ? void 0 : item.tvShowId) || (item === null || item === void 0 ? void 0 : item.showId) || (item === null || item === void 0 ? void 0 : item.type) === 'tv_episode')
            return 'tv';
        return 'movie';
    };
    const parseTmdbId = (item) => {
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
    };
    const extractEpisodeInfo = (item) => {
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
    };
    const normalizeTitle = (item) => {
        return String((item === null || item === void 0 ? void 0 : item.title) || (item === null || item === void 0 ? void 0 : item.name) || '').trim();
    };
    const computeYear = (item) => {
        const dateValue = (item === null || item === void 0 ? void 0 : item.release_date) || (item === null || item === void 0 ? void 0 : item.first_air_date);
        if (!dateValue)
            return null;
        const d = new Date(dateValue);
        if (isNaN(d.getTime()))
            return null;
        return d.getUTCFullYear();
    };
    const statusPriority = (s) => {
        if (s === 'completed')
            return 4;
        if (s === 'watching')
            return 3;
        if (s === 'plan_to_watch')
            return 2;
        if (s === 'dropped')
            return 1;
        return 0;
    };
    const upsertLibrary = (args) => {
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
    };
    const ensureEpisodeMap = async (titleKey) => {
        const cached = cachedEpisodeMaps.get(titleKey);
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
            summary.failures.push({ stage: 'catalog_lookup', id: titleKey, error: String((err === null || err === void 0 ? void 0 : err.message) || err) });
        }
        cachedEpisodeMaps.set(titleKey, map);
        return map;
    };
    const queueListItem = (uid, listId, itemKey, item, titleKey, mediaType) => {
        const addedAt = toTimestamp((item === null || item === void 0 ? void 0 : item.dateAdded) || (item === null || item === void 0 ? void 0 : item.addedAt) || now);
        const displayTitle = normalizeTitle(item).slice(0, 200) || titleKey;
        listItemWrites.push({
            ref: db.collection('users').doc(uid).collection('lists').doc(listId).collection('items').doc(itemKey),
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
        });
    };
    const handleLegacyItem = async (source, sourceListId, item) => {
        const mediaType = detectMediaType(item);
        const tmdbId = parseTmdbId(item);
        if (!tmdbId) {
            summary.failures.push({ stage: 'parse_item', id: String((item === null || item === void 0 ? void 0 : item.id) || ''), error: 'Unable to determine TMDB id.' });
            return;
        }
        const titleKey = mediaType === 'tv' ? `tmdb_tv_${tmdbId}` : `tmdb_movie_${tmdbId}`;
        const epInfo = extractEpisodeInfo(item);
        const watchedAt = toTimestamp((item === null || item === void 0 ? void 0 : item.watched_at) || (item === null || item === void 0 ? void 0 : item.watchedAt) || (item === null || item === void 0 ? void 0 : item.dateAdded) || now);
        let sourceStatus = null;
        if (source === 'watchlist')
            sourceStatus = 'plan_to_watch';
        if (source === 'watched')
            sourceStatus = epInfo ? 'watching' : 'completed';
        upsertLibrary({
            titleKey,
            mediaType,
            sourceStatus,
            listId: sourceListId,
            item,
            watchedAt: source === 'watched' ? watchedAt : null,
        });
        const itemKey = epInfo
            ? `${titleKey}_s${String(epInfo.seasonNumber).padStart(2, '0')}e${String(epInfo.episodeNumber).padStart(2, '0')}`
            : titleKey;
        queueListItem(targetUid, sourceListId, itemKey, item, titleKey, mediaType);
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
    const commitInChunks = async (writes, chunkSize = 450) => {
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
                summary.failures.push({ stage: 'batch_commit', error: String((err === null || err === void 0 ? void 0 : err.message) || err) });
            }
        }
    };
    try {
        const userRef = db.collection('users').doc(targetUid);
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
        await commitInChunks(baseListWrites);
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
        const episodeWrites = [];
        for (const ep of episodeStateCandidates) {
            const episodeMap = await ensureEpisodeMap(ep.titleKey);
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
            const stateId = `${ep.titleKey}_s${String(ep.seasonNumber).padStart(2, '0')}e${String(ep.episodeNumber).padStart(2, '0')}`;
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
        await commitInChunks(listItemWrites);
        await commitInChunks(libraryWrites);
        await commitInChunks(episodeWrites);
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
//# sourceMappingURL=index.js.map