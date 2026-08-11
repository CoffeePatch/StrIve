import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { listsAdapter } from '../../domain/lists/listsAdapter';
import { MAX_PINNED_LISTS } from '../../domain/lists/listConstants';

// Async thunks for custom lists
export const fetchLists = createAsyncThunk(
  "lists/fetchLists",
  async (userId, { rejectWithValue }) => {
    try {
      const lists = await listsAdapter.fetchUserListsWithPreviews(userId);

      // Sort: Pinned lists first, then by creation date
      const sortedLists = [...lists].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;

        if (a.isPinned && b.isPinned) {
          const dateA = new Date(a.pinnedAt || 0);
          const dateB = new Date(b.pinnedAt || 0);
          return dateB - dateA;
        }

        const dateA = new Date(a.createdAt || 0);
        const dateB = new Date(b.createdAt || 0);
        return dateB - dateA;
      });

      return sortedLists;
    } catch (error) {
      return rejectWithValue(error.toString());
    }
  }
);

export const pinListThunk = createAsyncThunk(
  "lists/pinList",
  async ({ userId, listId }, { getState, rejectWithValue }) => {
    try {
      const state = getState();
      const pinnedCount =
        state.lists.customLists.lists?.filter((list) => list.isPinned).length ||
        0;

      // Check if pin limit reached (max 5)
      if (pinnedCount >= MAX_PINNED_LISTS) {
        throw new Error(
          `Maximum of ${MAX_PINNED_LISTS} pinned lists reached. Please unpin a list first.`
        );
      }

      await listsAdapter.pinList(userId, listId);
      return { listId, pinnedAt: new Date().toISOString() };
    } catch (error) {
      return rejectWithValue(error.message || error.toString());
    }
  }
);

export const unpinListThunk = createAsyncThunk(
  "lists/unpinList",
  async ({ userId, listId }, { rejectWithValue }) => {
    try {
      await listsAdapter.unpinList(userId, listId);
      return listId;
    } catch (error) {
      return rejectWithValue(error.toString());
    }
  }
);

export const createDefaultList = createAsyncThunk(
  "lists/createDefaultList",
  async (userId, { rejectWithValue }) => {
    try {
      const newListId = await listsAdapter.createDefaultWatchLaterList(userId);
      return {
        id: newListId,
        name: "Watch Later",
        description: "Your default watch later list",
        ownerId: userId,
        createdAt: new Date().toISOString(),
        isPinned: true,
        pinnedAt: new Date().toISOString(),
        items: [],
      };
    } catch (error) {
      return rejectWithValue(error.toString());
    }
  }
);

export const createList = createAsyncThunk(
  "lists/createList",
  async ({ userId, listData }, { rejectWithValue }) => {
    try {
      const newListId = await listsAdapter.createList(userId, listData);
      const now = new Date();
      // Return both the new list ID and the original listData to construct the full list object
      return {
        id: newListId,
        ...listData,
        ownerId: userId,
        createdAt: now,
        // Set pinnedAt if the list is pinned
        ...(listData.isPinned && { pinnedAt: now }),
      };
    } catch (error) {
      return rejectWithValue(error.toString());
    }
  }
);

export const deleteList = createAsyncThunk(
  "lists/deleteList",
  async ({ userId, listId }, { rejectWithValue }) => {
    try {
      await listsAdapter.deleteList(userId, listId);
      return listId; // Return the ID of the deleted list
    } catch (error) {
      return rejectWithValue(error.toString());
    }
  }
);

export const updateListMetadata = createAsyncThunk(
  "lists/updateListMetadata",
  async ({ userId, listId, updates }, { rejectWithValue }) => {
    try {
      const result = await listsAdapter.updateList(userId, listId, updates);
      return {
        listId,
        updates: {
          ...(typeof result.name === "string" ? { name: result.name } : {}),
          ...(typeof result.description === "string"
            ? { description: result.description }
            : {}),
        },
      };
    } catch (error) {
      return rejectWithValue(error.toString());
    }
  }
);

export const addItem = createAsyncThunk(
  "lists/addItem",
  async ({ userId, listId, mediaItem }, { rejectWithValue }) => {
    try {
      await listsAdapter.addItemToList(userId, listId, mediaItem);
      return { listId, item: { ...mediaItem, dateAdded: new Date() } }; // Return list ID and the item added
    } catch (error) {
      return rejectWithValue(error.toString());
    }
  }
);

export const removeItem = createAsyncThunk(
  "lists/removeItem",
  async ({ userId, listId, mediaItem }, { rejectWithValue }) => {
    try {
      await listsAdapter.removeItemFromList(userId, listId, mediaItem);
      return { listId, mediaItem }; // Return list ID and the removed identity
    } catch (error) {
      return rejectWithValue(error.toString());
    }
  }
);

export const addItemsBatch = createAsyncThunk(
  "lists/addItemsBatch",
  async ({ userId, listId, items }, { rejectWithValue }) => {
    try {
      await listsAdapter.addItemsBatch(userId, listId, items);
      // Return the items with dateAdded for Redux state update
      const itemsWithDate = items.map((item) => ({
        ...item,
        dateAdded: new Date().toISOString(),
      }));
      return { listId, items: itemsWithDate };
    } catch (error) {
      return rejectWithValue(error.toString());
    }
  }
);

export const fetchActiveList = createAsyncThunk(
  "lists/fetchActiveList",
  async ({ userId, listId }, { rejectWithValue }) => {
    try {
      const listData = await listsAdapter.fetchListWithItems(userId, listId);
      return listData;
    } catch (error) {
      return rejectWithValue(error.toString());
    }
  }
);

export const reorderListItemThunk = createAsyncThunk(
  "lists/reorderListItem",
  async ({ userId, listId, titleKey, beforeTitleKey, afterTitleKey, previousItems }, { rejectWithValue }) => {
    try {
      await listsAdapter.reorderListItems(userId, listId, { titleKey, beforeTitleKey, afterTitleKey });
      return { listId, titleKey, beforeTitleKey, afterTitleKey };
    } catch (error) {
      return rejectWithValue({ error: error.toString(), previousItems });
    }
  }
);

const listsSlice = createSlice({
  name: "lists",
  initialState: {
    customLists: { lists: [], status: "idle", error: null }, // All user's lists (replaces watchlist)
    activeList: { details: null, items: [], status: "idle", error: null }, // For the currently viewed list
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      // Fetch Lists
      .addCase(fetchLists.pending, (state) => {
        state.customLists.status = "loading";
      })
      .addCase(fetchLists.fulfilled, (state, action) => {
        state.customLists.status = "succeeded";
        state.customLists.lists = action.payload;
      })
      .addCase(fetchLists.rejected, (state, action) => {
        state.customLists.status = "failed";
        state.customLists.error = action.payload;
      })
      // Create List
      .addCase(createList.pending, (state) => {
        state.customLists.status = "loading";
      })
      .addCase(createList.fulfilled, (state, action) => {
        state.customLists.status = "succeeded";
        state.customLists.lists.push(action.payload);
        // Re-sort lists to ensure pinned lists appear at the top
        state.customLists.lists.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          if (a.isPinned && b.isPinned) {
            return new Date(b.pinnedAt) - new Date(a.pinnedAt);
          }
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
      })
      .addCase(createList.rejected, (state, action) => {
        state.customLists.status = "failed";
        state.customLists.error = action.payload;
      })
      // Delete List
      .addCase(deleteList.pending, (state) => {
        state.customLists.status = "loading";
      })
      .addCase(deleteList.fulfilled, (state, action) => {
        state.customLists.status = "succeeded";
        state.customLists.lists = state.customLists.lists.filter(
          (list) => list.id !== action.payload
        );

        if (state.activeList.details?.id === action.payload) {
          state.activeList.details = null;
          state.activeList.items = [];
          state.activeList.status = "idle";
          state.activeList.error = null;
        }
      })
      .addCase(deleteList.rejected, (state, action) => {
        state.customLists.status = "failed";
        state.customLists.error = action.payload;
      })
      // Add Item
      .addCase(addItem.pending, (state) => {
        state.activeList.status = "loading";
      })
      .addCase(addItem.fulfilled, (state, action) => {
        state.activeList.status = "succeeded";
        // Only update the active list if it's the same list
        if (
          state.activeList.details &&
          state.activeList.details.id === action.payload.listId
        ) {
          state.activeList.items.push(action.payload.item);
        }
      })
      .addCase(addItem.rejected, (state, action) => {
        state.activeList.status = "failed";
        state.activeList.error = action.payload;
      })
      // Remove Item
      .addCase(removeItem.pending, (state) => {
        state.activeList.status = "loading";
      })
      .addCase(removeItem.fulfilled, (state, action) => {
        state.activeList.status = "succeeded";
        // Only update the active list if it's the same list
        if (
          state.activeList.details &&
          state.activeList.details.id === action.payload.listId
        ) {
          state.activeList.items = state.activeList.items.filter(
            (item) => item.id !== action.payload.mediaId
          );
        }
      })
      .addCase(removeItem.rejected, (state, action) => {
        state.activeList.status = "failed";
        state.activeList.error = action.payload;
      })
      // Add Items Batch
      .addCase(addItemsBatch.pending, (state) => {
        state.activeList.status = "loading";
      })
      .addCase(addItemsBatch.fulfilled, (state, action) => {
        state.activeList.status = "succeeded";
        // Only update the active list if it's the same list
        if (
          state.activeList.details &&
          state.activeList.details.id === action.payload.listId
        ) {
          state.activeList.items.push(...action.payload.items);
        }
      })
      .addCase(addItemsBatch.rejected, (state, action) => {
        state.activeList.status = "failed";
        state.activeList.error = action.payload;
      })
      // Fetch Active List
      .addCase(fetchActiveList.pending, (state) => {
        state.activeList.status = "loading";
      })
      .addCase(fetchActiveList.fulfilled, (state, action) => {
        state.activeList.status = "succeeded";
        // Convert any Timestamps in the list details to serializable format
        const listDetails = action.payload;
        if (
          listDetails.createdAt &&
          typeof listDetails.createdAt.toDate === "function"
        ) {
          listDetails.createdAt = listDetails.createdAt.toDate().toISOString();
        }

        state.activeList.details = listDetails;
        // Convert any Timestamps in the items to serializable format
        state.activeList.items = (action.payload.items || []).map((item) => {
          // Create a copy of the item to avoid mutating the original
          const processedItem = { ...item };

          // Convert dateAdded Timestamp to ISO string if it exists
          if (
            processedItem.dateAdded &&
            typeof processedItem.dateAdded.toDate === "function"
          ) {
            processedItem.dateAdded = processedItem.dateAdded
              .toDate()
              .toISOString();
          }

          // Convert release_date Timestamp to ISO string if it exists (though this is typically already a string)
          if (
            processedItem.release_date &&
            typeof processedItem.release_date.toDate === "function"
          ) {
            processedItem.release_date = processedItem.release_date
              .toDate()
              .toISOString();
          }

          // Convert any other Timestamp fields if they exist
          if (
            processedItem.createdAt &&
            typeof processedItem.createdAt.toDate === "function"
          ) {
            processedItem.createdAt = processedItem.createdAt
              .toDate()
              .toISOString();
          }

          return processedItem;
        });
        state.activeList.error = null;
      })
      .addCase(fetchActiveList.rejected, (state, action) => {
        state.activeList.status = "failed";
        state.activeList.error = action.payload;
      })
      // Update List Metadata
      .addCase(updateListMetadata.pending, (state) => {
        state.customLists.status = "loading";
      })
      .addCase(updateListMetadata.fulfilled, (state, action) => {
        state.customLists.status = "succeeded";
        const { listId, updates } = action.payload;

        const list = state.customLists.lists.find((l) => l.id === listId);
        if (list) {
          if (typeof updates.name === "string") list.name = updates.name;
          if (typeof updates.description === "string") list.description = updates.description;
        }

        if (state.activeList.details?.id === listId) {
          if (typeof updates.name === "string") state.activeList.details.name = updates.name;
          if (typeof updates.description === "string") state.activeList.details.description = updates.description;
        }
      })
      .addCase(updateListMetadata.rejected, (state, action) => {
        state.customLists.status = "failed";
        state.customLists.error = action.payload;
      })
      // Pin List
      .addCase(pinListThunk.fulfilled, (state, action) => {
        const { listId, pinnedAt } = action.payload;
        const list = state.customLists.lists.find((l) => l.id === listId);
        if (list) {
          list.isPinned = true;
          list.pinnedAt = pinnedAt;
        }
        // Re-sort lists to move pinned to top
        state.customLists.lists.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          if (a.isPinned && b.isPinned) {
            return new Date(b.pinnedAt) - new Date(a.pinnedAt);
          }
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
      })
      .addCase(pinListThunk.rejected, (state, action) => {
        state.customLists.error = action.payload;
      })
      // Unpin List
      .addCase(unpinListThunk.fulfilled, (state, action) => {
        const listId = action.payload;
        const list = state.customLists.lists.find((l) => l.id === listId);
        if (list) {
          list.isPinned = false;
          list.pinnedAt = null;
        }
        // Re-sort lists
        state.customLists.lists.sort((a, b) => {
          if (a.isPinned && !b.isPinned) return -1;
          if (!a.isPinned && b.isPinned) return 1;
          if (a.isPinned && b.isPinned) {
            return new Date(b.pinnedAt) - new Date(a.pinnedAt);
          }
          return new Date(b.createdAt) - new Date(a.createdAt);
        });
      })
      // Create Default List
      .addCase(createDefaultList.fulfilled, (state, action) => {
        state.customLists.lists.unshift(action.payload);
      })
      // Reorder List Item Error Rollback
      .addCase(reorderListItemThunk.rejected, (state, action) => {
        if (action.payload?.previousItems && state.activeList.items) {
          state.activeList.items = action.payload.previousItems;
        }
        state.activeList.error = action.payload?.error || "Failed to reorder list items";
      });
  },
});

export default listsSlice.reducer;
