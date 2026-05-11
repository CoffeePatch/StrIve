import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

const scrubListIdFromCollection = async (
  uid: string,
  listId: string,
  collectionName: string
) => {
  const db = admin.firestore();
  const fieldPathDocId = admin.firestore.FieldPath.documentId();
  const remove = admin.firestore.FieldValue.arrayRemove(listId);
  const updatedAt = admin.firestore.FieldValue.serverTimestamp();

  const pageSize = 500;
  let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
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
    if (snap.empty) break;

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

    if (snap.size < pageSize) break;
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
export const onCustomListDeleted = functions.firestore
  .document('users/{uid}/custom_lists/{listId}')
  .onDelete(async (_snap, context) => {
    const uid = context.params.uid as string;
    const listId = context.params.listId as string;

    functions.logger.info('Custom list deleted; scrubbing tags', { uid, listId });

    const v2Updated = await scrubListIdFromCollection(uid, listId, 'library_items');

    let legacyUpdated = 0;
    try {
      legacyUpdated = await scrubListIdFromCollection(uid, listId, 'library');
    } catch (err) {
      functions.logger.debug('Legacy scrub skipped/failed', {
        uid,
        listId,
        message: (err as any)?.message || String(err),
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
