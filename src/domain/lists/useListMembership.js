import { useDispatch } from 'react-redux';
import { useCallback } from 'react';
import { addItem, removeItem, addItemsBatch } from '../../util/store/listsSlice';

export const useListMembership = (userId) => {
  const dispatch = useDispatch();

  const addMediaToList = useCallback((listId, mediaItem) => {
    if (userId && listId && mediaItem) {
      return dispatch(addItem({ userId, listId, mediaItem })).unwrap();
    }
  }, [dispatch, userId]);

  const removeMediaFromList = useCallback((listId, mediaId) => {
    if (userId && listId && mediaId) {
      return dispatch(removeItem({ userId, listId, mediaItem: mediaId })).unwrap();
    }
  }, [dispatch, userId]);

  const addMediaBatchToList = useCallback((listId, items) => {
    if (userId && listId && items && items.length > 0) {
      return dispatch(addItemsBatch({ userId, listId, items })).unwrap();
    }
  }, [dispatch, userId]);

  const getItemMemberships = useCallback(async (mediaItem) => {
    if (userId && mediaItem) {
      const { listsAdapter } = await import('./listsAdapter');
      return await listsAdapter.getItemListMemberships(userId, mediaItem);
    }
    return [];
  }, [userId]);

  const setItemMemberships = useCallback(async (mediaItem, listIds) => {
    if (userId && mediaItem && listIds) {
      const { listsAdapter } = await import('./listsAdapter');
      return await listsAdapter.setItemListMemberships(userId, mediaItem, listIds);
    }
  }, [userId]);

  return {
    addMediaToList,
    removeMediaFromList,
    addMediaBatchToList,
    getItemMemberships,
    setItemMemberships
  };
};
