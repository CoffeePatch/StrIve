import { auth } from '../../util/firebase/firebase';
import { readLibraryIdentity } from '../library/libraryIdentity';

async function getAuthHeader() {
  const user = auth.currentUser;
  if (!user) return {};
  const token = await user.getIdToken();
  return { Authorization: `Bearer ${token}` };
}

function extractTitleKey(mediaItem) {
  if (typeof mediaItem === "string") return mediaItem;
  return readLibraryIdentity(mediaItem).titleKey;
}

/**
 * listsAdapter is the persistence boundary for custom lists, now backed by PostgreSQL API endpoints.
 */
export const listsAdapter = {
  createList: async (userId, listData) => {
    const headers = await getAuthHeader();
    const response = await fetch("/api/lists", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify({
        name: listData.name,
        description: listData.description || ""
      })
    });

    if (!response.ok) throw new Error(`Failed to create list (${response.status})`);
    const data = await response.json();
    return data.id;
  },

  deleteList: async (userId, listId) => {
    const headers = await getAuthHeader();
    const response = await fetch(`/api/lists/${listId}`, {
      method: "DELETE",
      headers
    });

    if (!response.ok) throw new Error(`Failed to delete list (${response.status})`);
    return true;
  },

  updateList: async (_userId, listId, updates = {}) => {
    const headers = await getAuthHeader();
    const response = await fetch(`/api/lists/${listId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify(updates)
    });

    if (!response.ok) throw new Error(`Failed to update list (${response.status})`);
    return await response.json();
  },

  fetchUserLists: async () => {
    const headers = await getAuthHeader();
    const response = await fetch("/api/lists", { headers });
    if (!response.ok) throw new Error(`Failed to fetch user lists (${response.status})`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  },

  fetchListWithItems: async (_userId, listId) => {
    const headers = await getAuthHeader();
    const response = await fetch(`/api/lists/${listId}`, { headers });
    if (!response.ok) throw new Error(`Failed to fetch list items (${response.status})`);
    return await response.json();
  },

  pinList: async (userId, listId) => {
    return listsAdapter.updateList(userId, listId, { isPinned: true });
  },

  unpinList: async (userId, listId) => {
    return listsAdapter.updateList(userId, listId, { isPinned: false });
  },

  getItemListMemberships: async () => {
    // Member list lookup is handled directly by catalog/details API
    return [];
  },

  setItemListMemberships: async () => {
    // Handled via individual list item additions/removals
    return true;
  },

  addItemToList: async (userId, listId, mediaItem) => {
    const titleKey = extractTitleKey(mediaItem);
    const headers = await getAuthHeader();
    const response = await fetch(`/api/lists/${listId}/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify({ titleKeys: [titleKey] })
    });

    if (!response.ok) throw new Error(`Failed to add item to list (${response.status})`);
    return true;
  },

  removeItemFromList: async (userId, listId, mediaId) => {
    const titleKey = extractTitleKey(mediaId);
    const headers = await getAuthHeader();
    const response = await fetch(`/api/lists/${listId}/items`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify({ titleKeys: [titleKey] })
    });

    if (!response.ok) throw new Error(`Failed to remove item from list (${response.status})`);
    return true;
  },
  
  addItemsBatch: async (userId, listId, items) => {
    const titleKeys = items.map(extractTitleKey);
    const headers = await getAuthHeader();
    const response = await fetch(`/api/lists/${listId}/items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify({ titleKeys })
    });

    if (!response.ok) throw new Error(`Failed to batch add items (${response.status})`);
    return true;
  },

  removeListIdFromAllItems: async () => {
    // Automatic DB CASCADE handles this on backend deleteList
    return true;
  },

  fetchUserListsWithPreviews: async (userId) => {
    return await listsAdapter.fetchUserLists(userId);
  },

  createDefaultWatchLaterList: async (userId) => {
    const existingLists = await listsAdapter.fetchUserLists(userId);
    const existingWatchLater = existingLists.find(
      (list) => (list.name || "").toLowerCase() === "watch later"
    );

    if (existingWatchLater) {
      return existingWatchLater.id;
    }

    return await listsAdapter.createList(userId, {
      name: "Watch Later",
      description: "Your default watch later list"
    });
  },

  reorderListItems: async (userId, listId, { titleKey, beforeTitleKey = null, afterTitleKey = null }) => {
    const headers = await getAuthHeader();
    const response = await fetch(`/api/lists/${listId}/reorder`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        ...headers
      },
      body: JSON.stringify({ titleKey, beforeTitleKey, afterTitleKey })
    });

    if (!response.ok) throw new Error(`Failed to reorder list items (${response.status})`);
    return await response.json();
  }
};
