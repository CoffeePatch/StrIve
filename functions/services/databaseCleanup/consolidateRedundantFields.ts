import * as admin from "firebase-admin";

interface ConsolidationResult {
  timestamp: string;
  docsProcessed: number;
  docsModified: number;
  imdbRatingsRemoved: number;
  imdbVotesRemoved: number;
  releaseYearRemoved: number;
}

/**
 * Removes redundant top-level imdbRating and imdbVotes fields
 * These values already exist in ratings.imdbScore and ratings.imdbVotes
 */
export const consolidateRedundantFields = async (userId: string): Promise<ConsolidationResult> => {
  console.log(`[CONSOLIDATE] Starting field consolidation for user: ${userId}`);

  const db = admin.firestore();
  const libraryPath = `users/${userId}/library_items`;
  const snapshot = await db.collection(libraryPath).get();

  const result: ConsolidationResult = {
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
    const updates: Record<string, any> = {};
    let needsUpdate = false;

    // Remove redundant imdbRating
    if (data.imdbRating !== undefined && data.ratings?.imdbScore !== undefined) {
      updates.imdbRating = admin.firestore.FieldValue.delete();
      result.imdbRatingsRemoved++;
      needsUpdate = true;
      console.log(`[CONSOLIDATE] ✓ Removed imdbRating from ${doc.id}`);
    }

    // Remove redundant imdbVotes
    if (data.imdbVotes !== undefined && data.ratings?.imdbVotes !== undefined) {
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
