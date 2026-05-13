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
exports.enrichReleaseDates = void 0;
const admin = __importStar(require("firebase-admin"));
const axios_1 = __importDefault(require("axios"));
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const getTmdbAuthConfig = () => {
    const bearerTokenRaw = process.env.TMDB_BEARER_TOKEN ||
        process.env.TMDB_V4_TOKEN ||
        process.env.TMDB_API_READ_ACCESS_TOKEN ||
        process.env.VITE_TMDB_KEY;
    const apiKey = process.env.TMDB_API_KEY;
    if (bearerTokenRaw) {
        const token = bearerTokenRaw.replace(/^Bearer\s+/i, "").trim();
        if (token) {
            return {
                headers: { Authorization: `Bearer ${token}` },
                params: { language: "en-US" },
            };
        }
    }
    if (apiKey) {
        return {
            params: { api_key: apiKey, language: "en-US" },
        };
    }
    throw new Error("TMDB credentials missing. Set one of: TMDB_BEARER_TOKEN, TMDB_V4_TOKEN, TMDB_API_READ_ACCESS_TOKEN, VITE_TMDB_KEY, or TMDB_API_KEY");
};
const parseTmdbIdFromDocId = (docId) => {
    const match = docId.match(/^tmdb_(movie|tv)_(\d+)/);
    if (!match)
        return null;
    const parsed = Number(match[2]);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};
/**
 * Fetches release date from TMDB API
 * Returns: "YYYY-MM-DD" or null
 */
const fetchReleaseDateFromTmdb = async (tmdbId, mediaType) => {
    try {
        const endpoint = `${TMDB_BASE_URL}/${mediaType}/${tmdbId}`;
        const response = await axios_1.default.get(endpoint, getTmdbAuthConfig());
        const data = response.data;
        if (mediaType === "movie") {
            return data.release_date || null;
        }
        else {
            return data.first_air_date || null;
        }
    }
    catch (error) {
        throw new Error(`TMDB API failed for ${mediaType} ${tmdbId}: ${error}`);
    }
};
/**
 * Enriches missing releaseDates by fetching from TMDB API
 * Processes in batches with exponential backoff
 */
const enrichReleaseDates = async (userId) => {
    console.log(`[ENRICH] Starting release date enrichment for user: ${userId}`);
    const db = admin.firestore();
    const libraryPath = `users/${userId}/library_items`;
    const snapshot = await db.collection(libraryPath).get();
    const docsToEnrich = snapshot.docs.filter((doc) => {
        const data = doc.data();
        return !data.releaseDate;
    });
    const result = {
        timestamp: new Date().toISOString(),
        docsProcessed: docsToEnrich.length,
        docsEnriched: 0,
        releaseYearRemoved: 0,
        docsSkipped: 0,
        docsFailed: 0,
        failures: [],
    };
    if (docsToEnrich.length === 0) {
        console.log("[ENRICH] No documents need enrichment");
        return result;
    }
    let batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500; // Firestore batch write limit
    for (let i = 0; i < docsToEnrich.length; i++) {
        const doc = docsToEnrich[i];
        const data = doc.data();
        const parsedTmdbId = Number(data.tmdbId);
        const fallbackTmdbId = parseTmdbIdFromDocId(doc.id);
        const tmdbId = Number.isInteger(parsedTmdbId) && parsedTmdbId > 0 ? parsedTmdbId : fallbackTmdbId;
        const mediaType = data.mediaType === "tv" ? "tv" : "movie";
        if (!tmdbId) {
            result.docsSkipped++;
            result.failures.push({
                docId: doc.id,
                tmdbId: -1,
                error: "Skipped: missing valid tmdbId",
            });
            console.warn(`[ENRICH] ⚠ ${doc.id}: skipped (no valid tmdbId)`);
            continue;
        }
        try {
            // Keep request pace safe without making the run unboundedly slow.
            if (i > 0) {
                await new Promise((resolve) => setTimeout(resolve, 120));
            }
            const releaseDate = await fetchReleaseDateFromTmdb(tmdbId, mediaType);
            if (releaseDate) {
                const updates = { releaseDate };
                if (data.releaseYear !== undefined) {
                    updates.releaseYear = admin.firestore.FieldValue.delete();
                    result.releaseYearRemoved++;
                }
                batch.update(doc.ref, updates);
                result.docsEnriched++;
                console.log(`[ENRICH] ✓ ${doc.id}: ${releaseDate}`);
            }
            else {
                result.docsFailed++;
                result.failures.push({
                    docId: doc.id,
                    tmdbId,
                    error: "No release date found in TMDB response",
                });
                console.warn(`[ENRICH] ✗ ${doc.id}: No date found`);
            }
            batchCount++;
            // Commit batch every BATCH_SIZE writes
            if (batchCount >= BATCH_SIZE) {
                await batch.commit();
                console.log(`[ENRICH] Batch committed (${batchCount} writes)`);
                batch = db.batch();
                batchCount = 0;
            }
        }
        catch (error) {
            result.docsFailed++;
            result.failures.push({
                docId: doc.id,
                tmdbId,
                error: String(error),
            });
            console.error(`[ENRICH] ✗ ${doc.id}: ${error}`);
        }
    }
    // Commit remaining batch
    if (batchCount > 0) {
        await batch.commit();
        console.log(`[ENRICH] Final batch committed (${batchCount} writes)`);
    }
    console.log(`[ENRICH] Complete. Result:`, JSON.stringify(result, null, 2));
    return result;
};
exports.enrichReleaseDates = enrichReleaseDates;
//# sourceMappingURL=enrichReleaseDates.js.map