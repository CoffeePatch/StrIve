import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../../util/firebase/firebase";
import { setLibraryItemStatus, upsertLibraryItem } from "../../util/firebase/firestoreService";

/**
 * Helper to generate the Firestore document key for a library item.
 * Preserves existing schema and behavior.
 */
function generateTitleKey(mediaId, mediaType = "movie") {
  const type = mediaType === "tv" ? "tv" : "movie";
  return `tmdb_${type}_${mediaId}`;
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
  updateLibraryStatus: async (userId, mediaItem, status) => {
    return await setLibraryItemStatus(userId, mediaItem, status);
  },

  /**
   * Forcibly refreshes metadata and sets the library status.
   * Typically used when you want a full metadata refresh alongside a status change.
   */
  saveLibraryItem: async (userId, mediaItem, status = null) => {
    return await upsertLibraryItem(userId, mediaItem, { status, isUserInteraction: true });
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

  markCompleted: async (userId, mediaItem) => {
    return await libraryAdapter.updateLibraryStatus(userId, mediaItem, "Completed");
  },

  unmarkCompleted: async (userId, mediaItem) => {
    return await libraryAdapter.updateLibraryStatus(userId, mediaItem, null);
  },

  // --- Real-Time Status Subscriptions ---

  /**
   * Fetches the raw status string from Firestore once.
   */
  getLibraryStatus: async (userId, mediaItem) => {
    const titleKey = generateTitleKey(mediaItem.id, mediaItem.media_type);
    const ref = doc(db, "users", userId, "library_items", titleKey);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return readWatchStatus(snap.data());
    }
    return null;
  },

  /**
   * Subscribes to real-time status changes for a library item.
   * Returns an unsubscribe function.
   */
  subscribeToLibraryStatus: (userId, mediaItem, onStatusChange, onError) => {
    const titleKey = generateTitleKey(mediaItem.id, mediaItem.media_type);
    const ref = doc(db, "users", userId, "library_items", titleKey);
    return onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          onStatusChange(readWatchStatus(snap.data()));
        } else {
          onStatusChange(null);
        }
      },
      (err) => {
        if (onError) onError(err);
      }
    );
  }
};
