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
import '../../styles/LibraryMasterPage.css';

const LibraryMasterPage = () => {
  const { user } = useSelector((store) => store.user);
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
  const setActivePrimaryTab = (t) => updateFilters({ type: t === 'shows' ? 'tv' : t === 'movies' ? 'movie' : 'all' });

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

    // Capture cloned snapshots of pre-mutation state
    const previousItems = [...items];
    const previousCustomListsItemsMap = {};
    for (const k in customListsItemsMap) {
      previousCustomListsItemsMap[k] = [...(customListsItemsMap[k] || [])];
    }

    // Optimistically remove from all UI state
    setItems((prev) => prev.filter((x) => x.titleKey !== item.titleKey));
    if (customListIds.length === 1) {
      const listId = customListIds[0];
      setCustomListsItemsMap(prev => ({
        ...prev,
        [listId]: prev[listId]?.filter(x => x.titleKey !== item.titleKey) || []
      }));
    }

    try {
      if (customListIds.length === 1) {
        await removeMediaFromList(customListIds[0], item.id);
      } else {
        await libraryAdapter.updateLibraryStatus(user.uid, item, null);
      }
    } catch (error) {
      console.error('Remove failed:', error);
      setItems(previousItems);
      setCustomListsItemsMap(previousCustomListsItemsMap);
      toast.error('Failed to remove item');
      return;
    }

    toast(({ closeToast }) => (
      <div className="flex items-center gap-3">
        <span className="text-sm">Removed from {customListIds.length === 1 ? 'List' : 'Library'}</span>
        <button
          className="text-sm underline"
          onClick={async () => {
            try {
              if (customListIds.length === 1) {
                await addMediaToList(customListIds[0], item);
              } else {
                await libraryAdapter.updateLibraryStatus(user.uid, item, item?.tracking?.watchStatus || 'plan_to_watch');
              }
              setItems((prev) => [...prev, item]);
              if (customListIds.length === 1) {
                const listId = customListIds[0];
                setCustomListsItemsMap(prev => ({
                  ...prev,
                  [listId]: [...(prev[listId] || []), item]
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
  }, [user?.uid, customListIds, customListsItemsMap, items, removeMediaFromList, addMediaToList]);

  // Group presentation props into cohesive interfaces
  const headerProps = useMemo(() => ({
    itemCount: sortedAndFilteredItems.length,
    searchQuery,
    setSearchQuery,
    viewMode,
    setViewMode,
    sortState,
    setSortState,
    onImportClick: () => navigate('/import'),
  }), [sortedAndFilteredItems.length, searchQuery, setSearchQuery, viewMode, setViewMode, sortState, setSortState, navigate]);

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
    </LibraryFiltersContext.Provider>
  );
};

export default LibraryMasterPage;
