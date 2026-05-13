import * as admin from "firebase-admin";

interface NormalizationResult {
  timestamp: string;
  docsProcessed: number;
  docsModified: number;
  watchStatusAdded: number;
  updatedAtAdded: number;
  lastWatchedAtAdded: number;
}

/**
 * Normalizes tracking structure for all documents
 * - Adds watchStatus: null to movies missing it
 * - Adds updatedAt timestamp if missing
 * - Adds lastWatchedAt: null if missing
 */
export const normalizeTracking = async (userId: string): Promise<NormalizationResult> => {
  console.log(`[NORMALIZE] Starting tracking normalization for user: ${userId}`);

  const db = admin.firestore();
  const libraryPath = `users/${userId}/library_items`;
  const snapshot = await db.collection(libraryPath).get();

  const result: NormalizationResult = {
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
    const updates: Record<string, any> = {};
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
