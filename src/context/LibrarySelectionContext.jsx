import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { readLibraryIdentity } from '../domain/library/libraryIdentity';

const LibrarySelectionContext = createContext(null);

export const LibrarySelectionProvider = ({ children }) => {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [lastSelectedTitleKey, setLastSelectedTitleKey] = useState(null);

  // Invariant: Exiting selection mode ALWAYS clears selected ID set and anchor.
  const exitSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
    setLastSelectedTitleKey(null);
  }, []);

  const enterSelectionMode = useCallback(() => {
    setIsSelectionMode(true);
  }, []);

  const toggleSelectionMode = useCallback(() => {
    if (isSelectionMode) {
      exitSelectionMode();
    } else {
      enterSelectionMode();
    }
  }, [isSelectionMode, exitSelectionMode, enterSelectionMode]);

  const toggleSelectItem = useCallback((item) => {
    const { titleKey } = readLibraryIdentity(item);
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(titleKey)) {
        newSet.delete(titleKey);
      } else {
        newSet.add(titleKey);
      }
      return newSet;
    });
    setLastSelectedTitleKey(titleKey);
  }, []);

  const selectRange = useCallback((displayItems, targetItem) => {
    if (!displayItems || displayItems.length === 0 || !targetItem) return;
    const { titleKey: targetKey } = readLibraryIdentity(targetItem);

    if (!lastSelectedTitleKey) {
      toggleSelectItem(targetItem);
      return;
    }

    const anchorIndex = displayItems.findIndex(
      (item) => readLibraryIdentity(item).titleKey === lastSelectedTitleKey
    );
    const targetIndex = displayItems.findIndex(
      (item) => readLibraryIdentity(item).titleKey === targetKey
    );

    if (anchorIndex === -1 || targetIndex === -1) {
      toggleSelectItem(targetItem);
      return;
    }

    const start = Math.min(anchorIndex, targetIndex);
    const end = Math.max(anchorIndex, targetIndex);

    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      for (let i = start; i <= end; i++) {
        const { titleKey } = readLibraryIdentity(displayItems[i]);
        newSet.add(titleKey);
      }
      return newSet;
    });
    setLastSelectedTitleKey(targetKey);
  }, [lastSelectedTitleKey, toggleSelectItem]);

  const selectFiltered = useCallback((filteredItems) => {
    const newSet = new Set();
    filteredItems.forEach(item => {
      const { titleKey } = readLibraryIdentity(item);
      newSet.add(titleKey);
    });
    setSelectedIds(newSet);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
    setLastSelectedTitleKey(null);
  }, []);

  const isItemSelected = useCallback((item) => {
    const { titleKey } = readLibraryIdentity(item);
    return selectedIds.has(titleKey);
  }, [selectedIds]);

  const getSelectedItems = useCallback((filteredItems) => {
    return filteredItems.filter(item => isItemSelected(item));
  }, [isItemSelected]);

  const value = useMemo(() => ({
    isSelectionMode,
    selectedIds,
    selectedCount: selectedIds.size,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelectionMode,
    toggleSelectItem,
    selectRange,
    selectFiltered,
    clearSelection,
    isItemSelected,
    getSelectedItems,
  }), [
    isSelectionMode,
    selectedIds,
    enterSelectionMode,
    exitSelectionMode,
    toggleSelectionMode,
    toggleSelectItem,
    selectRange,
    selectFiltered,
    clearSelection,
    isItemSelected,
    getSelectedItems
  ]);

  return (
    <LibrarySelectionContext.Provider value={value}>
      {children}
    </LibrarySelectionContext.Provider>
  );
};

const defaultSelectionContext = {
  isSelectionMode: false,
  selectedIds: new Set(),
  selectedCount: 0,
  enterSelectionMode: () => {},
  exitSelectionMode: () => {},
  toggleSelectionMode: () => {},
  toggleSelectItem: () => {},
  selectRange: () => {},
  selectFiltered: () => {},
  clearSelection: () => {},
  isItemSelected: () => false,
  getSelectedItems: () => [],
};

export const useLibrarySelection = () => {
  const context = useContext(LibrarySelectionContext);
  return context || defaultSelectionContext;
};
