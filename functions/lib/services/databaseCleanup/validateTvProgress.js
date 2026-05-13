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
exports.validateTvProgress = void 0;
const admin = __importStar(require("firebase-admin"));
const createEmptyNextToWatch = () => ({
    seasonNumber: null,
    episodeNumber: null,
});
/**
 * Validates and completes TV show progress structures
 * - Removes redundant tvProgress.lastWatchedAt (use tracking.lastWatchedAt instead)
 * - Ensures totalEpisodes, watchedEpisodes, completionPercent exist
 * - Normalizes nextToWatch to either null or {seasonNumber, episodeNumber}
 */
const validateTvProgress = async (userId) => {
    console.log(`[TV_PROGRESS] Starting TV progress validation for user: ${userId}`);
    const db = admin.firestore();
    const libraryPath = `users/${userId}/library_items`;
    const snapshot = await db
        .collection(libraryPath)
        .where("mediaType", "==", "tv")
        .get();
    const result = {
        timestamp: new Date().toISOString(),
        tvShowsProcessed: snapshot.size,
        docsModified: 0,
        tvProgressCreated: 0,
        tvProgressFixed: 0,
        lastWatchedAtRemoved: 0,
        nextToWatchNormalized: 0,
    };
    let batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500;
    for (const doc of snapshot.docs) {
        const data = doc.data();
        const tvProgress = data.tvProgress;
        const updates = {};
        let needsUpdate = false;
        // If tvProgress doesn't exist, create it
        if (!tvProgress) {
            updates.tvProgress = {
                totalEpisodes: data.number_of_episodes || null,
                watchedEpisodes: 0,
                completionPercent: 0,
                nextToWatch: createEmptyNextToWatch(),
            };
            result.tvProgressCreated++;
            needsUpdate = true;
            console.log(`[TV_PROGRESS] ✓ Created tvProgress structure for ${doc.id}`);
        }
        else {
            // Ensure required fields exist
            let tvProgressChanged = false;
            if (tvProgress.totalEpisodes === undefined) {
                updates["tvProgress.totalEpisodes"] = data.number_of_episodes || null;
                tvProgressChanged = true;
            }
            if (tvProgress.watchedEpisodes === undefined) {
                updates["tvProgress.watchedEpisodes"] = 0;
                tvProgressChanged = true;
            }
            if (tvProgress.completionPercent === undefined) {
                updates["tvProgress.completionPercent"] = 0;
                tvProgressChanged = true;
            }
            if (tvProgress.nextToWatch === undefined || tvProgress.nextToWatch === null) {
                updates["tvProgress.nextToWatch"] = createEmptyNextToWatch();
                result.nextToWatchNormalized++;
                tvProgressChanged = true;
            }
            else if (typeof tvProgress.nextToWatch !== "object" ||
                Array.isArray(tvProgress.nextToWatch) ||
                tvProgress.nextToWatch.seasonNumber === undefined ||
                tvProgress.nextToWatch.episodeNumber === undefined) {
                updates["tvProgress.nextToWatch"] = createEmptyNextToWatch();
                result.nextToWatchNormalized++;
                tvProgressChanged = true;
            }
            // Remove redundant lastWatchedAt (use tracking.lastWatchedAt instead)
            if (tvProgress.lastWatchedAt !== undefined) {
                updates["tvProgress.lastWatchedAt"] = admin.firestore.FieldValue.delete();
                result.lastWatchedAtRemoved++;
                tvProgressChanged = true;
                console.log(`[TV_PROGRESS] ✓ Removed redundant lastWatchedAt from ${doc.id}`);
            }
            if (tvProgressChanged) {
                result.tvProgressFixed++;
                needsUpdate = true;
                console.log(`[TV_PROGRESS] ✓ Fixed tvProgress structure for ${doc.id}`);
            }
        }
        if (needsUpdate) {
            batch.update(doc.ref, updates);
            result.docsModified++;
            batchCount++;
            if (batchCount >= BATCH_SIZE) {
                await batch.commit();
                batch = db.batch();
                batchCount = 0;
            }
        }
    }
    if (batchCount > 0) {
        await batch.commit();
        console.log(`[TV_PROGRESS] Batch committed (${batchCount} writes)`);
    }
    console.log(`[TV_PROGRESS] Complete. Result:`, JSON.stringify(result, null, 2));
    return result;
};
exports.validateTvProgress = validateTvProgress;
//# sourceMappingURL=validateTvProgress.js.map