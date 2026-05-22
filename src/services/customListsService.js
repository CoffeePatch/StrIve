import {
  collection,
  doc,
  setDoc,
  getDocs,
  getDoc,
  addDoc,
  deleteDoc,
  writeBatch,
  where,
  query,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  arrayRemove
} from 'firebase/firestore';
import { db } from '../../util/firebase/firebase';
import { setLibraryItemListIds, getLibraryItemListIds } from '../../util/firebase/firestoreService';

/**
 * Creates a new custom list for a user in Firestore.
 * @param {string} userId - The UID of the user from Firebase Auth.
 * @param {Object} listData - The data for the new list (e.g., { name: 'Test List' }).
 * @returns {Promise<string>} - A promise that resolves to the ID of the created list.
 */
export const createCustomList = async (userId, listData) => {
  try {
    const listsRef = collection(db, "users", userId, "lists");
    const newListData = {
      ...listData,
      createdAt: new Date(),
      ownerId: userId,
    };
    const docRef = await addDoc(listsRef, newListData);
    console.log(`Successfully created custom list with ID: ${docRef.id}`);
    return docRef.id;
  } catch (error) {
    console.error("Error creating custom list: ", error);
    throw error;
  }
};

/**
 * Deletes a custom list and all its items from Firestore.
 * @param {string} userId - The UID of the user from Firebase Auth.
 * @param {string} listId - The ID of the list to delete.
 */
export const deleteCustomList = async (userId, listId) => {
  try {
    const listRef = doc(db, "users", userId, "lists", listId);
    await deleteDoc(listRef);

    console.log(`Successfully deleted custom list with ID: ${listId}`);
  } catch (error) {
    console.error("Error deleting custom list: ", error);
    throw error;
  }
};

/**
 * Updates a custom list's metadata (name/description).
 * Writes to users/{uid}/lists/{listId}.
 */
export const updateCustomList = async (userId, listId, updates = {}) => {
  if (!userId) throw new Error("Missing userId");
  if (!listId) throw new Error("Missing listId");

  const payload = {
    ...(typeof updates.name === "string" ? { name: updates.name } : {}),
    ...(typeof updates.description === "string"
      ? { description: updates.description }
      : {}),
    updatedAt: Timestamp.now(),
  };

  const listRef = doc(db, "users", userId, "lists", listId);
  await setDoc(listRef, payload, { merge: true });
  return {
    listId,
    ...(typeof payload.name === "string" ? { name: payload.name } : {}),
    ...(typeof payload.description === "string" ? { description: payload.description } : {}),
  };
};

/**
 * Data hygiene: remove a deleted listId from any library items that still reference it.
 * - users/{uid}/library_items where listIds array contains listId
 *
 * Returns number of docs updated.
 */
export const removeListIdFromAllLibraryItems = async (userId, listId, options = {}) => {
  if (!userId) throw new Error("Missing userId");
  if (!listId) throw new Error("Missing listId");

  const pageSize = Math.min(Math.max(Number(options.pageSize) || 400, 1), 450);
  let lastDoc = null;
  let updatedCount = 0;

  while (true) {
    const constraints = [
      where("tracking.listIds", "array-contains", listId),
      orderBy("titleKey"),
      limit(pageSize),
    ];

    if (lastDoc) {
      constraints.splice(2, 0, startAfter(lastDoc));
    }

    const q = query(collection(db, "users", userId, "library_items"), ...constraints);
    const snap = await getDocs(q);

    if (snap.empty) break;

    const batch = writeBatch(db);
    snap.docs.forEach((d) => {
      batch.update(d.ref, { "tracking.listIds": arrayRemove(listId), "tracking.updatedAt": Timestamp.now() });
    });
    await batch.commit();

    updatedCount += snap.docs.length;
    lastDoc = snap.docs[snap.docs.length - 1];

    if (snap.docs.length < pageSize) break;
  }

  return updatedCount;
};

/**
 * Adds an item to a custom list in Firestore.
 * @param {string} userId - The UID of the user from Firebase Auth.
 * @param {string} listId - The ID of the list to add the item to.
 * @param {Object} mediaItem - The media item to add to the list.
 */
export const addItemToCustomList = async (userId, listId, mediaItem) => {
  try {
    await setLibraryItemListIds(userId, mediaItem, [listId]);
    console.log(
      `Successfully added ${mediaItem.title || mediaItem.name} to custom list ${listId}`
    );
  } catch (error) {
    console.error("Error adding item to custom list: ", error);
    throw error;
  }
};

/**
 * Adds multiple items to a custom list in Firestore using batch writes.
 * @param {string} userId - The UID of the user.
 * @param {string} listId - The ID of the list.
 * @param {Array} items - Array of media items to add.
 */
export const addItemsToCustomListBatch = async (userId, listId, items) => {
  try {
    const chunkSize = 450;
    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      const promises = chunk.map((mediaItem) =>
        setLibraryItemListIds(userId, mediaItem, [listId])
      );
      await Promise.all(promises);
      console.log(`Successfully added batch of ${chunk.length} items to list ${listId}`);
    }
    console.log(`Successfully added ${items.length} items to custom list ${listId}`);
  } catch (error) {
    console.error("Error batch adding items to custom list: ", error);
    throw error;
  }
};

/**
 * Removes an item from a custom list in Firestore.
 * @param {string} userId - The UID of the user from Firebase Auth.
 * @param {string} listId - The ID of the list to remove the item from.
 * @param {string|number} mediaId - The ID of the media item to remove.
 */
export const removeItemFromCustomList = async (userId, listId, mediaId) => {
  try {
    const mediaType = mediaId.includes("_tv_") ? "tv" : "movie";
    const numericId = Number(mediaId.split("_").pop());
    const mediaItem = { id: numericId, media_type: mediaType };
    const currentListIds = await getLibraryItemListIds(userId, mediaItem);
    const updatedListIds = currentListIds.filter((id) => id !== listId);
    await setLibraryItemListIds(userId, mediaItem, updatedListIds);
    console.log(
      `Successfully removed item ${mediaId} from custom list ${listId}`
    );
  } catch (error) {
    console.error("Error removing item from custom list: ", error);
    throw error;
  }
};

/**
 * Fetches all custom lists for a user from Firestore.
 * @param {string} userId - The UID of the user.
 * @returns {Promise<Array>} - A promise that resolves to an array of custom list objects.
 */
export const fetchUserLists = async (userId) => {
  try {
    const listsRef = collection(db, "users", userId, "lists");
    const querySnapshot = await getDocs(listsRef);
    const lists = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    return lists;
  } catch (error) {
    console.error("Error fetching user's custom lists: ", error);
    throw error;
  }
};

/**
 * Fetches custom lists with item previews for a user from Firestore.
 * @param {string} userId - The UID of the user.
 * @returns {Promise<Array>} - A promise that resolves to an array of custom lists with first 10 items.
 */
export const fetchUserListsWithPreviews = async (userId) => {
  try {
    const lists = await fetchUserLists(userId);
    return lists;
  } catch (error) {
    console.error("Error fetching user's custom lists with previews: ", error);
    throw error;
  }
};

/**
 * Fetches a custom list and all its items from Firestore.
 * @param {string} userId - The UID of the user.
 * @param {string} listId - The ID of the list to fetch.
 * @returns {Promise<Object>} - A promise that resolves to an object containing the list data and items.
 */
export const fetchListWithItems = async (userId, listId) => {
  try {
    const listRef = doc(db, "users", userId, "lists", listId);
    const listSnap = await getDoc(listRef);

    if (!listSnap.exists()) {
      throw new Error(`List with ID ${listId} does not exist for user ${userId}`);
    }

    const listData = {
      id: listSnap.id,
      ...listSnap.data(),
    };

    return listData;
  } catch (error) {
    console.error("Error fetching list with items: ", error);
    throw error;
  }
};

/**
 * Pins a custom list for a user.
 * @param {string} userId - The UID of the user.
 * @param {string} listId - The ID of the list to pin.
 */
export const pinList = async (userId, listId) => {
  try {
    const listRef = doc(db, "users", userId, "lists", listId);
    await setDoc(
      listRef,
      {
        isPinned: true,
        pinnedAt: new Date(),
      },
      { merge: true }
    );
    console.log(`Successfully pinned list ${listId}`);
  } catch (error) {
    console.error("Error pinning list: ", error);
    throw error;
  }
};

/**
 * Unpins a custom list for a user.
 * @param {string} userId - The UID of the user.
 * @param {string} listId - The ID of the list to unpin.
 */
export const unpinList = async (userId, listId) => {
  try {
    const listRef = doc(db, "users", userId, "lists", listId);
    await setDoc(
      listRef,
      {
        isPinned: false,
        pinnedAt: null,
      },
      { merge: true }
    );
    console.log(`Successfully unpinned list ${listId}`);
  } catch (error) {
    console.error("Error unpinning list: ", error);
    throw error;
  }
};

/**
 * Creates a default "Watch Later" pinned list for new users.
 * @param {string} userId - The UID of the user.
 * @returns {Promise<string>} - The ID of the created list.
 */
export const createDefaultWatchLaterList = async (userId) => {
  try {
    const existingLists = await fetchUserLists(userId);
    const existingWatchLater = existingLists.find(
      (list) => (list.name || "").toLowerCase() === "watch later"
    );

    if (existingWatchLater) {
      return existingWatchLater.id;
    }

    const listsRef = collection(db, "users", userId, "lists");
    const newListData = {
      name: "Watch Later",
      description: "Your default watch later list",
      createdAt: new Date(),
      ownerId: userId,
      isPinned: true,
      pinnedAt: new Date(),
    };
    const docRef = await addDoc(listsRef, newListData);
    console.log(
      `Successfully created default Watch Later list with ID: ${docRef.id}`
    );
    return docRef.id;
  } catch (error) {
    console.error("Error creating default Watch Later list: ", error);
    throw error;
  }
};

/**
 * Updates an item with enriched data (ratings, posters, etc.)
 * @param {string} userId
 * @param {string} listId
 * @param {string} itemId
 * @param {Object} enrichedData
 */
export const updateItemEnrichment = async (
  userId,
  itemId,
  enrichedData
) => {
  try {
    const libraryItemRef = doc(db, "users", userId, "library_items", String(itemId));
    await setDoc(
      libraryItemRef,
      {
        ...enrichedData,
          "tracking.updatedAt": Timestamp.now(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error(`Failed to enrich item ${itemId}:`, error);
    throw error;
  }
};

/**
 * Fetches items that need enrichment from a specific list
 * @param {string} userId
 * @param {string} listId
 * @param {number} limitCount
 */
export const getPendingItemsInList = async (userId, listId, limitCount = 5) => {
  try {
    const libraryItemsRef = collection(db, "users", userId, "library_items");
    const q = query(
      libraryItemsRef,
      where("tracking.listIds", "array-contains", listId),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
  } catch (error) {
    console.error("Error fetching items in list:", error);
    return [];
  }
};