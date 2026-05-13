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
exports.normalizeTracking = void 0;
const admin = __importStar(require("firebase-admin"));
/**
 * Normalizes tracking structure for all documents
 * - Adds watchStatus: null to movies missing it
 * - Adds updatedAt timestamp if missing
 * - Adds lastWatchedAt: null if missing
 */
const normalizeTracking = async (userId) => {
    console.log(`[NORMALIZE] Starting tracking normalization for user: ${userId}`);
    const db = admin.firestore();
    const libraryPath = `users/${userId}/library_items`;
    const snapshot = await db.collection(libraryPath).get();
    const result = {
        timestamp: new Date().toISOString(),
        docsProcessed: snapshot.size,
        docsModified: 0,
        watchStatusAdded: 0,
        updatedAtAdded: 0,
        lastWatchedAtAdded: 0,
    };
    let batch = db.batch();
    let batchCount = 0;
    const BATCH_SIZE = 500;
    const now = admin.firestore.Timestamp.now();
    for (const doc of snapshot.docs) {
        const data = doc.data();
        const tracking = data.tracking || {};
        const updates = {};
        let needsUpdate = false;
        // Movies: ensure watchStatus exists
        if (data.mediaType === "movie" && tracking.watchStatus === undefined) {
            updates["tracking.watchStatus"] = null;
            result.watchStatusAdded++;
            needsUpdate = true;
            console.log(`[NORMALIZE] ✓ Added watchStatus to movie ${doc.id}`);
        }
        // All docs: ensure updatedAt exists
        if (!tracking.updatedAt) {
            updates["tracking.updatedAt"] = now;
            result.updatedAtAdded++;
            needsUpdate = true;
            console.log(`[NORMALIZE] ✓ Added updatedAt to ${doc.id}`);
        }
        // All docs: ensure lastWatchedAt exists
        if (tracking.lastWatchedAt === undefined) {
            updates["tracking.lastWatchedAt"] = null;
            result.lastWatchedAtAdded++;
            needsUpdate = true;
            console.log(`[NORMALIZE] ✓ Added lastWatchedAt to ${doc.id}`);
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
        console.log(`[NORMALIZE] Batch committed (${batchCount} writes)`);
    }
    console.log(`[NORMALIZE] Complete. Result:`, JSON.stringify(result, null, 2));
    return result;
};
exports.normalizeTracking = normalizeTracking;
//# sourceMappingURL=normalizeTracking.js.map