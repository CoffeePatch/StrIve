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
exports.enrichList = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const net_1 = require("../../utils/net");
const enrichment_1 = require("../../services/enrichment");
const common_1 = require("./common");
exports.enrichList = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }
    try {
        const listId = (0, common_1.extractListIdFromPath)(req.path, 'enrich');
        const uid = await (0, common_1.requireUidFromAuthHeader)(req.headers.authorization);
        const itemsCollectionRef = await (0, common_1.resolveListItemsCollection)(uid, listId);
        res.status(202).json({
            success: true,
            message: 'Enrichment started in background. Check back later for results.',
        });
        const itemsSnapshot = await itemsCollectionRef.get();
        if (itemsSnapshot.empty)
            return;
        const tmdbApiKey = process.env.TMDB_API_KEY;
        const imdbApiBase = process.env.IMDB_API_BASE_URL;
        const limit = (0, net_1.pLimit)(3);
        await Promise.all(itemsSnapshot.docs.map((doc) => limit(async () => {
            const item = doc.data();
            if (item.enrichmentStatus === 'enriched')
                return;
            const updates = {};
            let hasTmdbData = false;
            let hasImdbData = false;
            if (item.tmdbId) {
                try {
                    const mediaType = item.media_type === 'tv' ? 'tv' : 'movie';
                    const tmdbData = await (0, enrichment_1.fetchTmdbDetails)(mediaType, item.tmdbId, tmdbApiKey);
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
            if (item.imdbId && imdbApiBase) {
                try {
                    const imdbData = await (0, enrichment_1.fetchImdbRatings)(item.imdbId);
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
            await new Promise((resolve) => setTimeout(resolve, 2000));
        })));
        console.log(`✅ Enrichment complete for list ${listId}`);
    }
    catch (error) {
        if (error instanceof common_1.HttpRequestError) {
            if (!res.headersSent) {
                res.status(error.status).json({ error: error.message });
            }
            return;
        }
        console.error('Error in background enrichment:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal server error' });
        }
    }
});
//# sourceMappingURL=enrichList.js.map