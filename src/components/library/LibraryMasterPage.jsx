import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import MobileLibraryView from './MobileLibraryView';
import LibraryDesktopView from './LibraryDesktopView';
import SortBottomSheet from './SortBottomSheet';
import QuickActionsModal from '../ui/QuickActionsModal';
import { useLists } from '../../domain/lists/useLists';
import { useListMembership } from '../../domain/lists/useListMembership';
import { libraryAdapter } from '../../domain/library/libraryAdapter';
import { useLibraryFilters } from '../../hooks/library/useLibraryFilters';
import { LibraryFiltersContext } from '../../hooks/library/LibraryFiltersContext';
import { loadLibraryItems, loadLibraryListItems } from '../../hooks/library/libraryDataPipeline';
import { LibrarySelectionProvider, useLibrarySelection } from '../../context/LibrarySelectionContext';
import BulkToolbar from './BulkToolbar';
import '../../styles/LibraryMasterPage.css';

const BulkToolbarIntegration = ({ userId, filteredItems, refreshLibrary }) => {
  const { 
    isSelectionMode, selectedCount, 
    exitSelectionMode, selectFiltered, clearSelection, getSelectedItems 
  } = useLibrarySelection();
  const [isProcessing, setIsProcessing] = useState(false);
  
  if (!isSelectionMode) return null;
  
  const handleUpdateStatus = async (status) => {
    setIsProcessing(true);
    try {
      const items = getSelectedItems(filteredItems);
      await libraryAdapter.batchUpdateStatus(userId, items, status);
      toast.success(`Updated status for ${items.length} items`);
      exitSelectionMode();
      refreshLibrary();
    } catch(err) {
      toast.error('Failed or partially updated items');
      exitSelectionMode();
      refreshLibrary();
    }
    setIsProcessing(false);
  };

  const handleDelete = async () => {
    const itemsToDelete = getSelectedItems(filteredItems);
    if (!itemsToDelete.length) return;

    exitSelectionMode();

    let undone = false;
    let toastId = null;

    const executeDelete = async () => {
      if (undone) return;
      try {
        await libraryAdapter.batchDeleteItems(userId, itemsToDelete);
        refreshLibrary();
      } catch (err) {
        console.error('Failed batch delete:', err);
        toast.error('Failed to delete items');
        refreshLibrary();
      }
    };

    const deleteTimer = setTimeout(() => {
      executeDelete();
    }, 5000);

    const handleUndo = () => {
      undone = true;
      clearTimeout(deleteTimer);
      if (toastId) toast.dismiss(toastId);
      toast.info(`Restored ${itemsToDelete.length} item${itemsToDelete.length !== 1 ? 's' : ''}`);
    };

    toastId = toast(
      ({ closeToast }) => (
        <div className="flex items-center justify-between w-full gap-3">
          <span className="text-sm font-medium">
            Deleting {itemsToDelete.length} item{itemsToDelete.length !== 1 ? 's' : ''}...
          </span>
          <button
            onClick={() => {
              handleUndo();
              closeToast();
            }}
            className="px-3 py-1 rounded bg-accent text-white font-bold text-xs hover:bg-accent/80 transition-colors shadow"
          >
            Undo
          </button>
        </div>
      ),
      {
        autoClose: 5000,
        closeOnClick: false,
        pauseOnHover: true,
        onClose: () => {
          if (!undone) {
            executeDelete();
          }
        }
      }
    );
  };

  return (
    <BulkToolbar
      selectedCount={selectedCount}
      totalCount={filteredItems.length}
      onSelectAll={() => selectFiltered(filteredItems)}
      onClearSelection={clearSelection}
      onUpdateStatus={handleUpdateStatus}
      onDelete={handleDelete}
      onClose={exitSelectionMode}
      isProcessing={isProcessing}
    />
  );
};


const LibraryMasterPage = () => {
  const user = useSelector((store) => store.user?.user);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [items, setItems] = useState([]);
  const [customListsItemsMap, setCustomListsItemsMap] = useState({});
  const { lists: customLists, loadLists } = useLists(user?.uid);
  const { addMediaToList, removeMediaFromList } = useListMembership(user?.uid);
  const [loading, setLoading] = useState(false);

  const libraryFilters = useLibraryFilters(items, customListsItemsMap);
  const {
    searchQuery, setSearchQuery,
    filtersOpen, setFiltersOpen,
    status, type, customListIds, sortState, setSortState,
    updateFilters, clearAdvancedFilters,
    filteredItems, activeSecondaryFilterCount,
    getImdbRating, getImdbVotes,
    imdbRatingMin, imdbVotesMin, tmdbRatingMin, tmdbVotesMin,
    genres, yearFrom, yearTo
  } = libraryFilters;

  const customListIdsRef = useRef(customListIds);
  useEffect(() => {
    customListIdsRef.current = customListIds;
  }, [customListIds]);

  const [activeMedia, setActiveMedia] = useState(null);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [quickActionsAnchor, setQuickActionsAnchor] = useState(null);

  const handleQuickActions = useCallback((media, e) => {
    setActiveMedia(media);
    if (e && e.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect();
      setQuickActionsAnchor({ x: rect.left, y: rect.bottom, right: window.innerWidth - rect.right });
    } else {
      setQuickActionsAnchor(null);
    }
    setQuickActionsOpen(true);
  }, []);

  const sortedAndFilteredItems = filteredItems;

  // Legacy mappings for MobileView
  const activePrimaryTab = type === 'tv' ? 'shows' : type === 'movie' ? 'movies' : 'all';
  const setActivePrimaryTab = useCallback((t) => {
    updateFilters({ type: t === 'shows' ? 'tv' : t === 'movies' ? 'movie' : 'all' });
  }, [updateFilters]);

  const [message, setMessage] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBottomSheetOpen, setSortBottomSheetOpen] = useState(false);
  const mockSize = searchParams.get('mockSize');

  const loadAllItems = useCallback(async (signal) => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      const fetchedItems = await loadLibraryItems(user.uid, {
        hydrate: false,
        includePageInfo: false,
        mockSize,
      });

      if (signal?.cancelled) return;

      setItems(fetchedItems);

      const activeListIds = customListIdsRef.current;
      const loadedListItemsMap = await loadLibraryListItems(user.uid, activeListIds, {
        hydrate: false,
        includePageInfo: false,
      });

      if (signal?.cancelled) return;

      setCustomListsItemsMap((prev) => ({
        ...prev,
        ...loadedListItemsMap,
      }));
    } catch (error) {
      console.error('Error loading library items:', error);
      if (!signal?.cancelled) {
        setMessage({ type: 'error', text: 'Failed to load library items' });
      }
    } finally {
      if (!signal?.cancelled) {
        setLoading(false);
      }
    }
  }, [user?.uid, mockSize]);

  const loadCustomLists = useCallback(async () => {
    if (!user?.uid) return;
    try {
      await loadLists();
    } catch (error) {
      console.error('Error loading custom lists:', error);
    }
  }, [user?.uid, loadLists]);

  // Initial load
  useEffect(() => {
    if (!user?.uid) return;
    const signal = { cancelled: false };
    loadCustomLists();
    loadAllItems(signal);
    return () => { signal.cancelled = true; };
  }, [user?.uid, loadCustomLists, loadAllItems]);

  // Lazy-load custom list items
  useEffect(() => {
    if (!user?.uid) return;
    const missingListIds = customListIds.filter((listId) => !customListsItemsMap[listId]);
    if (missingListIds.length === 0) return;

    loadLibraryListItems(user.uid, missingListIds, {
      hydrate: false,
      includePageInfo: false,
    })
      .then((nextListItemsMap) => {
        setCustomListsItemsMap((prev) => ({
          ...prev,
          ...nextListItemsMap,
        }));
      })
      .catch((err) => {
        console.error('Failed to load list items for listIds:', missingListIds, err);
      });
  }, [user?.uid, customListIds, customListsItemsMap]);

  const handleItemClick = useCallback((item) => {
    const mediaType = item.media_type || item.mediaType;
    const titleKey = item.titleKey || '';
    const keyMatch = String(titleKey).match(/^tmdb_(movie|tv)_(\d+)$/);
    const id = keyMatch ? keyMatch[2] : item.id;
    const isTVShow = mediaType === 'tv' || item.first_air_date;

    if (!id) return;
    if (isTVShow) {
      navigate(`/shows/${id}`);
    } else {
      navigate(`/movie/${id}`);
    }
  }, [navigate]);

  const handleRemove = useCallback(async (item) => {
    if (!user?.uid) return;

    let previousItems = [];
    let previousCustomListsItemsMap = {};

    const currentListIds = customListIdsRef.current;
    const isSingleList = currentListIds.length === 1;
    const activeListId = isSingleList ? currentListIds[0] : null;

    // Optimistically remove from all UI state using functional state updates
    setItems((prev) => {
      previousItems = prev;
      return prev.filter((x) => x.titleKey !== item.titleKey);
    });

    if (activeListId) {
      setCustomListsItemsMap((prev) => {
        previousCustomListsItemsMap = prev;
        return {
          ...prev,
          [activeListId]: prev[activeListId]?.filter((x) => x.titleKey !== item.titleKey) || []
        };
      });
    }

    try {
      if (activeListId) {
        await removeMediaFromList(activeListId, item.id);
      } else {
        await libraryAdapter.updateLibraryStatus(user.uid, item, null);
      }
    } catch (error) {
      console.error('Remove failed:', error);
      setItems(previousItems);
      if (activeListId) {
        setCustomListsItemsMap(previousCustomListsItemsMap);
      }
      toast.error('Failed to remove item');
      return;
    }

    toast(({ closeToast }) => (
      <div className="flex items-center gap-3">
        <span className="text-sm">Removed from {isSingleList ? 'List' : 'Library'}</span>
        <button
          className="text-sm underline"
          onClick={async () => {
            try {
              if (isSingleList) {
                await addMediaToList(activeListId, item);
              } else {
                await libraryAdapter.updateLibraryStatus(user.uid, item, item?.tracking?.watchStatus || 'plan_to_watch');
              }
              setItems((prev) => [...prev, item]);
              if (isSingleList) {
                setCustomListsItemsMap((prev) => ({
                  ...prev,
                  [activeListId]: [...(prev[activeListId] || []), item]
                }));
              }
              closeToast?.();
            } catch (undoErr) {
              console.error('Undo failed:', undoErr);
              toast.error('Undo failed');
            }
          }}
        >
          Undo
        </button>
      </div>
    ), { autoClose: 5000 });
  }, [user?.uid, removeMediaFromList, addMediaToList]);

  const handleImportClick = useCallback(() => {
    navigate('/import');
  }, [navigate]);

  // Group presentation props into cohesive interfaces
  const headerProps = useMemo(() => ({
    itemCount: sortedAndFilteredItems.length,
    searchQuery,
    setSearchQuery,
    viewMode,
    setViewMode,
    sortState,
    setSortState,
    onImportClick: handleImportClick,
  }), [sortedAndFilteredItems.length, searchQuery, setSearchQuery, viewMode, setViewMode, sortState, setSortState, handleImportClick]);

  const filterProps = useMemo(() => ({
    status,
    type,
    filtersOpen,
    setFiltersOpen,
    updateFilters,
    clearAdvancedFilters,
    activeSecondaryFilterCount,
    customListIds,
    customLists,
    imdbRatingMin,
    imdbVotesMin,
    tmdbRatingMin,
    tmdbVotesMin,
    genres,
    yearFrom,
    yearTo,
    libraryFilters,
  }), [status, type, filtersOpen, setFiltersOpen, updateFilters, clearAdvancedFilters, activeSecondaryFilterCount, customListIds, customLists, imdbRatingMin, imdbVotesMin, tmdbRatingMin, tmdbVotesMin, genres, yearFrom, yearTo, libraryFilters]);

  const gridProps = useMemo(() => ({
    totalItems: items.length,
    items: sortedAndFilteredItems,
    handleItemClick,
    handleRemove,
    onQuickActions: handleQuickActions,
    getImdbRating,
    getImdbVotes,
  }), [items.length, sortedAndFilteredItems, handleItemClick, handleRemove, handleQuickActions, getImdbRating, getImdbVotes]);

  return (
    <LibraryFiltersContext.Provider value={libraryFilters}>
      <LibrarySelectionProvider>
        {/* Desktop Layout Shell */}
      <LibraryDesktopView
        headerProps={headerProps}
        filterProps={filterProps}
        gridProps={gridProps}
        loading={loading}
        message={message}
      />

      {/* Mobile View Shell */}
      <div className="block md:hidden">
        <MobileLibraryView
          activePrimaryTab={activePrimaryTab}
          setActivePrimaryTab={setActivePrimaryTab}
          items={items}
          filteredItems={sortedAndFilteredItems}
          loading={loading}
          customLists={customLists}
          handleItemClick={handleItemClick}
          handleRemove={handleRemove}
          onQuickActions={handleQuickActions}
          getImdbRating={getImdbRating}
          getImdbVotes={getImdbVotes}
          message={message}
        />
      </div>

      <BulkToolbarIntegration 
        userId={user?.uid} 
        filteredItems={sortedAndFilteredItems} 
        refreshLibrary={() => loadAllItems({ cancelled: false })} 
      />

      {/* Modals & Bottom Sheets */}
      <SortBottomSheet
        isOpen={sortBottomSheetOpen}
        onClose={() => setSortBottomSheetOpen(false)}
        sortState={sortState}
        onSortChange={setSortState}
      />

      <QuickActionsModal
        isOpen={quickActionsOpen}
        onClose={() => setQuickActionsOpen(false)}
        media={activeMedia}
        userId={user?.uid}
        onMutation={loadAllItems}
        anchor={quickActionsAnchor}
      />
      </LibrarySelectionProvider>
    </LibraryFiltersContext.Provider>
  );
};

export default LibraryMasterPage;
