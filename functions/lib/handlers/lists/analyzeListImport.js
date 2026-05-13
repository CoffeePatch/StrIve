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
exports.analyzeListImport = void 0;
const functions = __importStar(require("firebase-functions"));
const Papa = __importStar(require("papaparse"));
const busboy_1 = __importDefault(require("busboy"));
const net_1 = require("../../utils/net");
const common_1 = require("./common");
exports.analyzeListImport = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const listId = (0, common_1.extractListIdFromPath)(req.path, 'import_analyze');
        const uid = await (0, common_1.requireUidFromAuthHeader)(req.headers.authorization);
        const itemsCollectionRef = await (0, common_1.resolveListItemsCollection)(uid, listId);
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
                file.on('end', () => {
                    csvBuffer = Buffer.concat(buffers);
                });
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
                const limit = (0, net_1.pLimit)(6);
                async function tmdbFindByImdb(imdbId, mt) {
                    if (!tmdbApiKey || !imdbId)
                        return null;
                    const url = `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?api_key=${tmdbApiKey}&external_source=imdb_id`;
                    try {
                        const r = await (0, net_1.fetchWithTimeout)(url, {}, 8000);
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
                        const r = await (0, net_1.fetchWithTimeout)(url, {}, 8000);
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
                        const r = await (0, net_1.fetchWithTimeout)(url, {}, 8000);
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
                    const mt = String(row.mediaType || '').trim() === 'tv' ? 'tv' : 'movie';
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
            }
            catch (parseError) {
                console.error('Error parsing CSV:', parseError);
                res.status(400).json({ error: 'Invalid CSV format' });
            }
        });
        req.pipe(busboy);
    }
    catch (error) {
        if (error instanceof common_1.HttpRequestError) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        console.error('Error analyzing CSV for import:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
//# sourceMappingURL=analyzeListImport.js.map