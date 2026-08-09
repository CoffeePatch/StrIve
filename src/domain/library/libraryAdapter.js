import { auth } from "../../util/firebase/firebase";
import { readLibraryIdentity } from "./libraryIdentity";
import { invalidateLibraryPipelineCache } from "../../hooks/library/libraryPipelineCache";
import { normalizeWatchStatus } from "../../util/library/watchStatus";

function generateTitleKey(libraryIdentity) {
  return readLibraryIdentity(libraryIdentity).titleKey;
}

async function getAuthHeader() {
  const user = auth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

/**
 * The Library Adapter acts as the persistence boundary for library operations.
 * Replaced Firestore direct calls with /api/library/* REST API calls.
 */
export const libraryAdapter = {
  updateLibraryStatus: async (userId, mediaItem, status, options = {}) => {
    const titleKey = generateTitleKey(mediaItem);
    const headers = await getAuthHeader();
    
    const response = await fetch(`/api/library/${titleKey}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify({
        status,
        lastWatchedAt: options.lastWatchedAt || null
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to update library status (${response.status})`);
    }

    invalidateLibraryPipelineCache(userId);
    return await response.json();
  },

  updateUserRating: async (userId, mediaItem, userRating) => {
    const titleKey = generateTitleKey(mediaItem);
    const headers = await getAuthHeader();
    
    const response = await fetch(`/api/library/${titleKey}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify({ userRating })
    });

    if (!response.ok) {
      throw new Error(`Failed to update user rating (${response.status})`);
    }

    invalidateLibraryPipelineCache(userId);
    return await response.json();
  },

  saveLibraryItem: async (userId, mediaItem, status = null) => {
    return await libraryAdapter.updateLibraryStatus(userId, mediaItem, status);
  },

  removeLibraryItem: async (userId, mediaItem) => {
    const titleKey = generateTitleKey(mediaItem);
    const headers = await getAuthHeader();

    const response = await fetch(`/api/library/${titleKey}`, {
      method: "DELETE",
      headers
    });

    if (!response.ok) {
      throw new Error(`Failed to delete library item (${response.status})`);
    }

    invalidateLibraryPipelineCache(userId);
    return await response.json();
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

  // --- Status Subscriptions ---

  getLibraryStatus: async (userId, mediaItem) => {
    const titleKey = generateTitleKey(mediaItem);
    const headers = await getAuthHeader();

    try {
      const response = await fetch(`/api/catalog/${titleKey}`, { headers });
      if (!response.ok) return { status: null, tracking: null };
      const data = await response.json();
      const catalog = data?.catalog || data;
      return {
        status: catalog?.userStatus || null,
        tracking: data?.progress || null
      };
    } catch (err) {
      console.warn("getLibraryStatus failed:", err);
      return { status: null, tracking: null };
    }
  },

  subscribeToLibraryStatus: (userId, mediaItem, onStatusChange, onError) => {
    // Non-realtime REST polling/fetch fallback for compatibility
    libraryAdapter.getLibraryStatus(userId, mediaItem)
      .then(({ status, tracking }) => onStatusChange(status, tracking))
      .catch((err) => onError && onError(err));

    return () => {}; // No-op unsubscribe function
  },

  // --- Batch Operations (Multi-Select) ---

  batchDeleteItems: async (userId, mediaItems) => {
    if (!userId || !mediaItems?.length) return;
    const titleKeys = mediaItems.map(item => generateTitleKey(item));
    const headers = await getAuthHeader();

    const response = await fetch(`/api/library/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify({
        action: "delete",
        titleKeys
      })
    });

    if (!response.ok) throw new Error("Batch delete failed");
    invalidateLibraryPipelineCache(userId);
  },

  batchUpdateStatus: async (userId, mediaItems, status) => {
    if (!userId || !mediaItems?.length) return;
    const titleKeys = mediaItems.map(item => generateTitleKey(item));
    const headers = await getAuthHeader();

    const response = await fetch(`/api/library/batch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify({
        action: "update_status",
        titleKeys,
        status: normalizeWatchStatus(status) ?? status
      })
    });

    if (!response.ok) throw new Error("Batch status update failed");
    invalidateLibraryPipelineCache(userId);
  },

  batchAddToList: async (userId, mediaItems, listId) => {
    if (!userId || !mediaItems?.length || !listId) return;
    const titleKeys = mediaItems.map(item => generateTitleKey(item));
    const headers = await getAuthHeader();

    const response = await fetch(`/api/lists/${listId}/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify({ titleKeys })
    });

    if (!response.ok) throw new Error("Batch add to list failed");
    invalidateLibraryPipelineCache(userId);
  },

  batchRemoveFromList: async (userId, mediaItems, listId) => {
    if (!userId || !mediaItems?.length || !listId) return;
    const titleKeys = mediaItems.map(item => generateTitleKey(item));
    const headers = await getAuthHeader();

    const response = await fetch(`/api/lists/${listId}/items`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify({ titleKeys })
    });

    if (!response.ok) throw new Error("Batch remove from list failed");
    invalidateLibraryPipelineCache(userId);
  },

  updateUserNotes: async (userId, mediaItem, notes) => {
    const titleKey = generateTitleKey(mediaItem);
    const headers = await getAuthHeader();

    const response = await fetch(`/api/library/${titleKey}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify({
        notes: notes !== undefined ? notes : null
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to update user notes (${response.status})`);
    }

    invalidateLibraryPipelineCache(userId);
    return await response.json();
  }
};
