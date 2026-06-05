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
 * listsAdapter is the only component that interacts with Firestore for lists.
 * It encapsulates all raw Firestore queries, writes, and references.
 */
export const listsAdapter = {
  createList: async (userId, listData) => {
    try {
      const listsRef = collection(db, "users", userId, "lists");
      const newListData = {
        ...listData,
        createdAt: new Date(),
        ownerId: userId,
      };
      const docRef = await addDoc(listsRef, newListData);
      return docRef.id;
    } catch (error) {
      console.error("Error creating custom list: ", error);
      throw error;
    }
  },

  deleteList: async (userId, listId) => {
    try {
      const listRef = doc(db, "users", userId, "lists", listId);
      await deleteDoc(listRef);
    } catch (error) {
      console.error("Error deleting custom list: ", error);
      throw error;
    }
  },

  updateList: async (userId, listId, updates = {}) => {
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
  },

  fetchUserLists: async (userId) => {
    try {
      const listsRef = collection(db, "users", userId, "lists");
      const querySnapshot = await getDocs(listsRef);
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
    } catch (error) {
      console.error("Error fetching user's custom lists: ", error);
      throw error;
    }
  },

  fetchListWithItems: async (userId, listId) => {
    try {
      const listRef = doc(db, "users", userId, "lists", listId);
      const listSnap = await getDoc(listRef);

      if (!listSnap.exists()) {
        throw new Error(`List with ID ${listId} does not exist for user ${userId}`);
      }

      return {
        id: listSnap.id,
        ...listSnap.data(),
      };
    } catch (error) {
      console.error("Error fetching list with items: ", error);
      throw error;
    }
  },

  pinList: async (userId, listId) => {
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
    } catch (error) {
      console.error("Error pinning list: ", error);
      throw error;
    }
  },

  unpinList: async (userId, listId) => {
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
    } catch (error) {
      console.error("Error unpinning list: ", error);
      throw error;
    }
  },

  getItemListMemberships: async (userId, mediaItem) => {
    try {
      return await getLibraryItemListIds(userId, mediaItem);
    } catch (error) {
      console.error("Error fetching item list memberships: ", error);
      return [];
    }
  },

  setItemListMemberships: async (userId, mediaItem, listIds) => {
    try {
      await setLibraryItemListIds(userId, mediaItem, listIds);
    } catch (error) {
      console.error("Error setting item list memberships: ", error);
      throw error;
    }
  },

  addItemToList: async (userId, listId, mediaItem) => {
    try {
      const currentListIds = await getLibraryItemListIds(userId, mediaItem);
      if (!currentListIds.includes(listId)) {
        await setLibraryItemListIds(userId, mediaItem, [...currentListIds, listId]);
      }
    } catch (error) {
      console.error("Error adding item to custom list: ", error);
      throw error;
    }
  },

  removeItemFromList: async (userId, listId, mediaId) => {
    try {
      const mediaType = String(mediaId).includes("_tv_") ? "tv" : "movie";
      const numericId = Number(String(mediaId).split("_").pop());
      const mediaItem = { id: numericId, media_type: mediaType };
      
      const currentListIds = await getLibraryItemListIds(userId, mediaItem);
      const updatedListIds = currentListIds.filter((id) => id !== listId);
      
      await setLibraryItemListIds(userId, mediaItem, updatedListIds);
    } catch (error) {
      console.error("Error removing item from custom list: ", error);
      throw error;
    }
  },
  
  addItemsBatch: async (userId, listId, items) => {
    try {
      const chunkSize = 450;
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        const promises = chunk.map(async (mediaItem) => {
          const currentListIds = await getLibraryItemListIds(userId, mediaItem);
          if (!currentListIds.includes(listId)) {
            await setLibraryItemListIds(userId, mediaItem, [...currentListIds, listId]);
          }
        });
        await Promise.all(promises);
      }
    } catch (error) {
      console.error("Error batch adding items to custom list: ", error);
      throw error;
    }
  },

  removeListIdFromAllItems: async (userId, listId, options = {}) => {
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
  },

  fetchUserListsWithPreviews: async (userId) => {
    // Current implementation just fetches lists, previews are handled by UI if needed
    return await listsAdapter.fetchUserLists(userId);
  },

  createDefaultWatchLaterList: async (userId) => {
    try {
      const existingLists = await listsAdapter.fetchUserLists(userId);
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
      return docRef.id;
    } catch (error) {
      console.error("Error creating default Watch Later list: ", error);
      throw error;
    }
  }
};
