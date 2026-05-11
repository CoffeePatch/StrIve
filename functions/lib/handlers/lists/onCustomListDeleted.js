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
exports.onCustomListDeleted = void 0;
const functions = __importStar(require("firebase-functions"));
const admin = __importStar(require("firebase-admin"));
const scrubListIdFromCollection = async (uid, listId, collectionName) => {
    const db = admin.firestore();
    const fieldPathDocId = admin.firestore.FieldPath.documentId();
    const remove = admin.firestore.FieldValue.arrayRemove(listId);
    const updatedAt = admin.firestore.FieldValue.serverTimestamp();
    const pageSize = 500;
    let lastDoc = null;
    let updatedCount = 0;
    let batchCount = 0;
    const maxBatches = 2000;
    while (batchCount < maxBatches) {
        let q = db
            .collection('users')
            .doc(uid)
            .collection(collectionName)
            .where('listIds', 'array-contains', listId)
            .orderBy(fieldPathDocId)
            .limit(pageSize);
        if (lastDoc) {
            q = q.startAfter(lastDoc);
        }
        const snap = await q.get();
        if (snap.empty)
            break;
        const batch = db.batch();
        snap.docs.forEach((docSnap) => {
            batch.update(docSnap.ref, {
                listIds: remove,
                updatedAt,
            });
        });
        await batch.commit();
        updatedCount += snap.size;
        lastDoc = snap.docs[snap.docs.length - 1];
        batchCount += 1;
        if (snap.size < pageSize)
            break;
    }
    if (batchCount >= maxBatches) {
        functions.logger.warn('ListId scrub hit maxBatches cap', {
            uid,
            listId,
            collectionName,
            updatedCount,
            batchCount,
        });
    }
    return updatedCount;
};
/**
 * When a custom list is deleted, remove its listId from any library item docs that still reference it.
 * This prevents orphaned tags.
 */
exports.onCustomListDeleted = functions.firestore
    .document('users/{uid}/custom_lists/{listId}')
    .onDelete(async (_snap, context) => {
    const uid = context.params.uid;
    const listId = context.params.listId;
    functions.logger.info('Custom list deleted; scrubbing tags', { uid, listId });
    const v2Updated = await scrubListIdFromCollection(uid, listId, 'library_items');
    let legacyUpdated = 0;
    try {
        legacyUpdated = await scrubListIdFromCollection(uid, listId, 'library');
    }
    catch (err) {
        functions.logger.debug('Legacy scrub skipped/failed', {
            uid,
            listId,
            message: (err === null || err === void 0 ? void 0 : err.message) || String(err),
        });
    }
    functions.logger.info('Custom list tag scrub complete', {
        uid,
        listId,
        v2Updated,
        legacyUpdated,
        totalUpdated: v2Updated + legacyUpdated,
    });
    return null;
});
//# sourceMappingURL=onCustomListDeleted.js.map