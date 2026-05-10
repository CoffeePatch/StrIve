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
exports.confirmListImport = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const net_1 = require("../../utils/net");
const common_1 = require("./common");
exports.confirmListImport = functions.https.onRequest(async (req, res) => {
    var _a;
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const listId = (0, common_1.extractListIdFromPath)(req.path, 'import_confirm');
        const uid = await (0, common_1.requireUidFromAuthHeader)(req.headers.authorization);
        const { moviesToImport } = req.body || {};
        if (!Array.isArray(moviesToImport)) {
            res.status(400).json({ error: 'Request body must contain an array of moviesToImport' });
            return;
        }
        if (moviesToImport.length === 0) {
            res.status(201).json({ success: true, moviesAdded: 0, message: 'No movies to import' });
            return;
        }
        const itemsCollectionRef = await (0, common_1.resolveListItemsCollection)(uid, listId);
        const existingSnapshot = await itemsCollectionRef.get();
        const existing = new Set(existingSnapshot.docs.map((d) => String((d.data() || {}).id)));
        const tmdbApiKey = process.env.TMDB_API_KEY;
        async function fetchDetailsTryBoth(id) {
            if (!tmdbApiKey)
                return { ok: false };
            const mUrl = `https://api.themoviedb.org/3/movie/${id}?api_key=${tmdbApiKey}`;
            const tUrl = `https://api.themoviedb.org/3/tv/${id}?api_key=${tmdbApiKey}`;
            try {
                const r = await (0, net_1.fetchWithTimeout)(mUrl, {}, 8000);
                if (r.ok) {
                    const j = await r.json();
                    return { ok: true, data: j, media_type: 'movie' };
                }
            }
            catch (_a) { }
            try {
                const r = await (0, net_1.fetchWithTimeout)(tUrl, {}, 8000);
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
        res.status(201).json({ success: true, moviesAdded, message: `${moviesAdded} movies successfully added to the list` });
    }
    catch (error) {
        if (error instanceof common_1.HttpRequestError) {
            res.status(error.status).json({ error: error.message });
            return;
        }
        console.error('Error confirming list import:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
//# sourceMappingURL=confirmListImport.js.map