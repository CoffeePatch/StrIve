import { useSelector, useDispatch } from 'react-redux';
import { useCallback } from 'react';
import {
  fetchLists,
  createList,
  deleteList,
  updateListMetadata,
  pinListThunk,
  unpinListThunk,
  fetchActiveList
} from '../../util/store/listsSlice';

export const useLists = (userId) => {
  const dispatch = useDispatch();
  
  const { lists, status: listsStatus, error: listsError } = useSelector(
    (state) => state.lists.customLists
  );
  
  const { details: activeListDetails, items: activeListItems, status: activeListStatus, error: activeListError } = useSelector(
    (state) => state.lists.activeList
  );

  const loadLists = useCallback(() => {
    if (userId) {
      return dispatch(fetchLists(userId)).unwrap();
    }
  }, [dispatch, userId]);

  const createNewList = useCallback((listData) => {
    if (userId) {
      return dispatch(createList({ userId, listData })).unwrap();
    }
  }, [dispatch, userId]);

  const removeList = useCallback((listId) => {
    if (userId && listId) {
      return dispatch(deleteList({ userId, listId })).unwrap();
    }
  }, [dispatch, userId]);

  const updateList = useCallback((listId, updates) => {
    if (userId && listId) {
      return dispatch(updateListMetadata({ userId, listId, updates })).unwrap();
    }
  }, [dispatch, userId]);

  const pinList = useCallback((listId) => {
    if (userId && listId) {
      return dispatch(pinListThunk({ userId, listId })).unwrap();
    }
  }, [dispatch, userId]);

  const unpinList = useCallback((listId) => {
    if (userId && listId) {
      return dispatch(unpinListThunk({ userId, listId })).unwrap();
    }
  }, [dispatch, userId]);

  const loadActiveList = useCallback((listId) => {
    if (userId && listId) {
      return dispatch(fetchActiveList({ userId, listId })).unwrap();
    }
  }, [dispatch, userId]);

  return {
    lists,
    listsStatus,
    listsError,
    activeListDetails,
    activeListItems,
    activeListStatus,
    activeListError,
    loadLists,
    createNewList,
    removeList,
    updateList,
    pinList,
    unpinList,
    loadActiveList
  };
};
