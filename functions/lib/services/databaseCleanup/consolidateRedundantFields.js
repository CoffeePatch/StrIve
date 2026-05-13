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
exports.consolidateRedundantFields = void 0;
const admin = __importStar(require("firebase-admin"));
/**
 * Removes redundant top-level imdbRating and imdbVotes fields
 * These values already exist in ratings.imdbScore and ratings.imdbVotes
 */
const consolidateRedundantFields = async (userId) => {
    var _a, _b;
    console.log(`[CONSOLIDATE] Starting field consolidation for user: ${userId}`);
    const db = admin.firestore();
    const libraryPath = `users/${userId}/library_items`;
    const snapshot = await db.collection(libraryPath).get();
    const result = {
        timestamp: new Date().toISOString(),
        docsProcessed: snapshot.size,
        docsModified: 0,
        imdbRatingsRemoved: 0,
        imdbVotesRemoved: 0,
        releaseYearRemoved: 0,
    };
    let batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500;
    for (const doc of snapshot.docs) {
        const data = doc.data();
        const updates = {};
        let needsUpdate = false;
        // Remove redundant imdbRating
        if (data.imdbRating !== undefined && ((_a = data.ratings) === null || _a === void 0 ? void 0 : _a.imdbScore) !== undefined) {
            updates.imdbRating = admin.firestore.FieldValue.delete();
            result.imdbRatingsRemoved++;
            needsUpdate = true;
            console.log(`[CONSOLIDATE] ✓ Removed imdbRating from ${doc.id}`);
        }
        // Remove redundant imdbVotes
        if (data.imdbVotes !== undefined && ((_b = data.ratings) === null || _b === void 0 ? void 0 : _b.imdbVotes) !== undefined) {
            updates.imdbVotes = admin.firestore.FieldValue.delete();
            result.imdbVotesRemoved++;
            needsUpdate = true;
            console.log(`[CONSOLIDATE] ✓ Removed imdbVotes from ${doc.id}`);
        }
        // Remove releaseYear after releaseDate has been populated
        if (data.releaseYear !== undefined && data.releaseDate) {
            updates.releaseYear = admin.firestore.FieldValue.delete();
            result.releaseYearRemoved++;
            needsUpdate = true;
            console.log(`[CONSOLIDATE] ✓ Removed releaseYear from ${doc.id}`);
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
        console.log(`[CONSOLIDATE] Batch committed (${batchCount} writes)`);
    }
    console.log(`[CONSOLIDATE] Complete. Result:`, JSON.stringify(result, null, 2));
    return result;
};
exports.consolidateRedundantFields = consolidateRedundantFields;
//# sourceMappingURL=consolidateRedundantFields.js.map