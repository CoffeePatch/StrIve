import { doc, getDoc, onSnapshot, writeBatch, Timestamp, arrayUnion, arrayRemove } from "firebase/firestore";
import { db } from "../../util/firebase/firebase";
import { setLibraryItemStatus, upsertLibraryItem } from "../../util/firebase/firestoreService";
import { readLibraryIdentity } from "./libraryIdentity";
import { invalidateLibraryPipelineCache } from "../../hooks/library/libraryPipelineCache";
import { normalizeWatchStatus } from "../../util/library/watchStatus";

/**
 * Helper to generate the Firestore document key for a library item.
 * Identity must already be explicit; no media-type inference happens here.
 */
function generateTitleKey(libraryIdentity) {
  return readLibraryIdentity(libraryIdentity).titleKey;
}

/**
 * Helper to extract status from the Firestore document payload.
 * Preserves backward compatibility.
 */
function readWatchStatus(data) {
  return (
    data?.tracking?.watchStatus ??
    data?.watchStatus ??
    data?.status ??
    null
  );
}

/**
 * The Library Adapter acts as the persistence boundary for library operations.
 * UI components speak domain language (e.g., addToWatchlist) to this adapter.
 * The adapter translates this intent into specific Firestore writes without altering the schema.
 */
export const libraryAdapter = {
  /**
   * Primary primitive for updating the watch status of an item.
   * If the item doesn't exist, it will be upserted.
   * Otherwise, only the tracking status is updated, preserving all other metadata.
   */
  updateLibraryStatus: async (userId, mediaItem, status, options = {}) => {
    return await setLibraryItemStatus(userId, mediaItem, status, options);
  },

  /**
   * Forcibly refreshes metadata and sets the library status.
   * Typically used when you want a full metadata refresh alongside a status change.
   */
  saveLibraryItem: async (userId, mediaItem, status = null) => {
    return await upsertLibraryItem(userId, mediaItem, mediaItem, { status, isUserInteraction: true });
  },

  /**
   * Completely removes a library item, including all metadata, tracking, and list memberships.
   */
  removeLibraryItem: async (userId, mediaItem) => {
    const { deleteLibraryItem } = await import("../../util/firebase/firestoreService");
    return await deleteLibraryItem(userId, mediaItem);
  },

  // --- Semantic Domain Operations ---

  addToWatchlist: async (userId, mediaItem) => {
    return await libraryAdapter.updateLibraryStatus(userId, mediaItem, "Plan to Watch");
  },

  removeFromWatchlist: async (userId, mediaItem) => {
    return await libraryAdapter.updateLibraryStatus(userId, mediaItem, null);
  },

  markCompleted: async (userId, mediaItem, options = {}) => {
    return await libraryAdapter.updateLibraryStatus(userId, mediaItem, "Completed", options);
  },

  unmarkCompleted: async (userId, mediaItem) => {
    return await libraryAdapter.updateLibraryStatus(userId, mediaItem, null);
  },

  // --- Real-Time Status Subscriptions ---

  /**
   * Fetches the raw status string from Firestore once.
   */
  getLibraryStatus: async (userId, mediaItem) => {
    const titleKey = generateTitleKey(mediaItem);
    const ref = doc(db, "users", userId, "library_items", titleKey);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return {
        status: readWatchStatus(snap.data()),
        tracking: snap.data()?.tracking || null
      };
    }
    return { status: null, tracking: null };
  },

  /**
   * Subscribes to real-time status changes for a library item.
   * Returns an unsubscribe function.
   */
  subscribeToLibraryStatus: (userId, mediaItem, onStatusChange, onError) => {
    const titleKey = generateTitleKey(mediaItem);
    const ref = doc(db, "users", userId, "library_items", titleKey);
    return onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          onStatusChange(readWatchStatus(snap.data()), snap.data()?.tracking || null);
        } else {
          onStatusChange(null, null);
        }
      },
      (err) => {
        if (onError) onError(err);
      }
    );
  },

  // --- Batch Operations (Multi-Select) ---

  /**
   * Executes an array of operations in Firestore batches (max 500 per chunk).
   * @param {Function} operationFn - (batch, chunkItems) => void
   * @param {Array} items - Array of library identities
   */
  _executeInBatches: async (items, operationFn) => {
    if (!items || items.length === 0) return;
    const CHUNK_SIZE = 500;
    const chunks = [];
    
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
      chunks.push(items.slice(i, i + CHUNK_SIZE));
    }

    for (const chunk of chunks) {
      const batch = writeBatch(db);
      operationFn(batch, chunk);
      await batch.commit();
    }
  },

  /**
   * Batch deletes multiple library items.
   */
  batchDeleteItems: async (userId, mediaItems) => {
    if (!userId || !mediaItems?.length) return;
    
    await libraryAdapter._executeInBatches(mediaItems, (batch, chunk) => {
      chunk.forEach((item) => {
        const titleKey = generateTitleKey(item);
        const ref = doc(db, "users", userId, "library_items", titleKey);
        batch.delete(ref);
      });
    });

    invalidateLibraryPipelineCache(userId);
  },

  /**
   * Batch updates watch status for multiple library items.
   */
  batchUpdateStatus: async (userId, mediaItems, status) => {
    if (!userId || !mediaItems?.length) return;
    const normalizedStatus = status === undefined ? null : (normalizeWatchStatus(status) ?? status);
    const now = Timestamp.now();

    await libraryAdapter._executeInBatches(mediaItems, (batch, chunk) => {
      chunk.forEach((item) => {
        const titleKey = generateTitleKey(item);
        const ref = doc(db, "users", userId, "library_items", titleKey);
        
        const trackingPayload = {
          watchStatus: normalizedStatus,
          updatedAt: now,
          lastUserInteractionAt: now
        };

        if (normalizedStatus === 'completed') {
          trackingPayload.lastWatchedAt = now;
        }

        batch.set(ref, { tracking: trackingPayload }, { merge: true });
      });
    });

    invalidateLibraryPipelineCache(userId);
  },

  /**
   * Batch adds multiple library items to a custom list.
   */
  batchAddToList: async (userId, mediaItems, listId) => {
    if (!userId || !mediaItems?.length || !listId) return;
    const now = Timestamp.now();

    await libraryAdapter._executeInBatches(mediaItems, (batch, chunk) => {
      chunk.forEach((item) => {
        const titleKey = generateTitleKey(item);
        const ref = doc(db, "users", userId, "library_items", titleKey);
        
        batch.set(ref, { 
          tracking: { 
            listIds: arrayUnion(listId),
            updatedAt: now,
            lastUserInteractionAt: now
          } 
        }, { merge: true });
      });
    });

    invalidateLibraryPipelineCache(userId);
  },

  /**
   * Batch removes multiple library items from a custom list.
   */
  batchRemoveFromList: async (userId, mediaItems, listId) => {
    if (!userId || !mediaItems?.length || !listId) return;
    const now = Timestamp.now();

    await libraryAdapter._executeInBatches(mediaItems, (batch, chunk) => {
      chunk.forEach((item) => {
        const titleKey = generateTitleKey(item);
        const ref = doc(db, "users", userId, "library_items", titleKey);
        
        batch.set(ref, { 
          tracking: { 
            listIds: arrayRemove(listId),
            updatedAt: now,
            lastUserInteractionAt: now
          } 
        }, { merge: true });
      });
    });

    invalidateLibraryPipelineCache(userId);
  }
};
