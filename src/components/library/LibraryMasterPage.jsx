import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MobileLibraryView from './MobileLibraryView';
import {
  getAllLibraryItems,
  getLibraryByListId,
} from '../../util/firebase/firestoreService';
import { useLists } from "../../domain/lists/useLists";
import { useListMembership } from "../../domain/lists/useListMembership";
import { libraryAdapter } from '../../domain/library/libraryAdapter';
import Header from '../layout/Header';
import '../../styles/LibraryMasterPage.css';
import { toast } from 'react-toastify';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { DURATIONS, EASINGS } from '../../util/motion';
import { AnimatedButton, AnimatedIconButton, AnimatedDropdown } from '../ui/AnimatedPrimitives';
import { useLibraryFilters } from '../../hooks/library/useLibraryFilters';
import { LibraryFiltersContext } from '../../hooks/library/LibraryFiltersContext';
import LibraryAdvancedFilters from './LibraryAdvancedFilters';
import LibraryGrid from './LibraryGrid';
import LibraryGridSkeleton from './LibraryGridSkeleton';
import SortBottomSheet from './SortBottomSheet';
import QuickActionsModal from '../ui/QuickActionsModal';

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

  const handleQuickActions = useCallback((media) => {
    setActiveMedia(media);
    setQuickActionsOpen(true);
  }, []);

  const sortedAndFilteredItems = filteredItems;

  // Legacy mappings for MobileView
  const activePrimaryTab = type === 'tv' ? 'shows' : 'movies';
  const setActivePrimaryTab = (t) => updateFilters({ type: t === 'shows' ? 'tv' : 'movie' });

  const [message, setMessage] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [searchFocused, setSearchFocused] = useState(false);
  const [sortBottomSheetOpen, setSortBottomSheetOpen] = useState(false);

  const loadCustomLists = useCallback(async () => {
    if (!user?.uid) return;
    try {
      await loadLists();
    } catch (error) {
      console.error('Error loading custom lists:', error);
    }
  }, [user?.uid, loadLists]);

  const loadAllItems = useCallback(async (signal) => {
    if (!user?.uid) return;
    try {
      setLoading(true);
      const fetchedItems = await getAllLibraryItems(user.uid, { hydrate: false, includePageInfo: false });
      if (signal?.cancelled) return;

      // Benchmarking duplication hook
      const mockSizeStr = searchParams.get('mockSize');
      let finalItems = fetchedItems;
      if (mockSizeStr) {
        const targetSize = parseInt(mockSizeStr, 10);
        if (targetSize && targetSize > 0) {
          let duplicated = [];
          while (duplicated.length < targetSize) {
            duplicated = duplicated.concat(fetchedItems.map((item, idx) => ({
              ...item,
              id: `${item.id}_mock_${duplicated.length}_${idx}`,
              titleKey: `${item.titleKey}_mock_${duplicated.length}_${idx}`
            })));
          }
          finalItems = duplicated.slice(0, targetSize);
        }
      }

      setItems(finalItems);

      // Refetch active custom list items in-place to avoid flashing
      const activeListIds = customListIdsRef.current;
      if (activeListIds && activeListIds.length > 0) {
        const fetchPromises = activeListIds.map(async (listId) => {
          const listItems = await getLibraryByListId(user.uid, listId, { hydrate: false, includePageInfo: false });
          return { listId, listItems };
        });
        const results = await Promise.all(fetchPromises);
        if (signal?.cancelled) return;
        setCustomListsItemsMap(prev => {
          const next = { ...prev };
          results.forEach(({ listId, listItems }) => {
            next[listId] = listItems;
          });
          return next;
        });
      }
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
  }, [user?.uid, searchParams]);

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
    customListIds.forEach(listId => {
      if (!customListsItemsMap[listId]) {
        getLibraryByListId(user.uid, listId, { hydrate: false, includePageInfo: false })
          .then(listItems => {
            setCustomListsItemsMap(prev => ({ ...prev, [listId]: listItems }));
          })
          .catch(err => {
            console.error("Failed to load list items for listId:", listId, err);
          });
      }
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
        // If viewing a specific custom list, the bin removes it from that list
        await removeMediaFromList(customListIds[0], item.id);
      } else {
        // Otherwise, it clears the watch status from the library
        await libraryAdapter.updateLibraryStatus(user.uid, item, null);
      }
    } catch (error) {
      console.error('Remove failed:', error);
      // Revert to cloned snapshots
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
              // Restore optimistic updates
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

  return (
    <LibraryFiltersContext.Provider value={libraryFilters}>
      <div className="hidden md:flex min-h-screen premium-page flex-col bg-[#0f1014]">
      <Header />

      <div className="pt-[100px] pb-8 w-full">
        {/* Library Header Bar */}
        <div className="flex justify-between items-end px-8 max-w-[1440px] mx-auto w-full mb-6">
          <div className="flex flex-col gap-1">
            <h1 className="text-[32px] font-bold text-white leading-none font-display">My Library</h1>
            <span className="text-[14px] text-white/60 leading-none mt-1 font-secondary">{sortedAndFilteredItems.length} items</span>
          </div>

          <div className="flex items-center gap-3">
            <div className={`relative flex items-center bg-white/5 border ${searchFocused ? 'border-red-600' : 'border-white/10'} rounded-lg transition-all duration-200 overflow-hidden h-[40px]`} style={{ width: searchFocused ? '320px' : '240px' }}>
              <span className="material-symbols-outlined text-white/60 text-base absolute left-3 pointer-events-none">search</span>
              <input 
                type="text" 
                className="w-full h-full bg-transparent pl-10 pr-3 text-[14px] text-white placeholder-white/40 focus:outline-none font-secondary" 
                placeholder="Search library..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
            </div>

            <div className="flex items-center bg-white/5 rounded-lg p-1 h-[40px]">
               <AnimatedIconButton onClick={() => setViewMode('grid')} className={`w-[36px] h-[32px] rounded flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-red-600 text-white' : 'text-white/60 hover:text-white'}`}><span className="material-symbols-outlined text-[18px]">grid_view</span></AnimatedIconButton>
               <AnimatedIconButton onClick={() => setViewMode('bookshelf')} className={`w-[36px] h-[32px] rounded flex items-center justify-center transition-colors ${viewMode === 'bookshelf' ? 'bg-red-600 text-white' : 'text-white/60 hover:text-white'}`}><span className="material-symbols-outlined text-[18px]">view_agenda</span></AnimatedIconButton>
            </div>

            <div className="relative">
              <button 
                onClick={() => setSortBottomSheetOpen(true)}
                className="bg-white/5 border border-white/10 h-[40px] px-4 rounded-lg text-[14px] text-white focus:outline-none cursor-pointer font-secondary hover:border-white/30 transition-colors flex items-center gap-2"
              >
                Sort
                <span className="material-symbols-outlined text-[16px] text-white/60">sort</span>
              </button>
            </div>

            <AnimatedIconButton onClick={() => navigate('/import')} className="w-[40px] h-[40px] rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white flex items-center justify-center transition-colors" title="Import from CSV"><span className="material-symbols-outlined text-[20px]">upload</span></AnimatedIconButton>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-8 max-w-[1440px] mx-auto w-full mb-6">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
             <div className="flex items-center">
               <div className="flex items-center gap-2">
                 {['all', 'watchlist', 'watching', 'completed'].map(s => (
                   <AnimatedButton key={s} onClick={() => updateFilters({ status: s })} className={`h-[36px] px-4 rounded-full text-[14px] font-secondary transition-colors border ${status === s ? 'bg-red-600 text-white border-red-600 font-semibold' : 'bg-white/5 text-white/80 border-white/10 hover:border-white/30 hover:text-white'}`}>
                      {s === 'all' ? 'All' : s === 'watchlist' ? 'Plan to Watch' : s.charAt(0).toUpperCase() + s.slice(1)}
                   </AnimatedButton>
                 ))}
               </div>

               <div className="w-[1px] h-[24px] bg-white/10 mx-4"></div>

                <div className="flex items-center gap-2">
                 <AnimatedButton onClick={() => updateFilters({ type: 'all' })} className={`h-[36px] px-4 rounded-full text-[14px] font-secondary transition-colors border flex items-center gap-2 ${type === 'all' ? 'bg-red-600 text-white border-red-600 font-semibold' : 'bg-white/5 text-white/80 border-white/10 hover:border-white/30 hover:text-white'}`}>
                   All Types
                 </AnimatedButton>
                 <AnimatedButton onClick={() => updateFilters({ type: 'movie' })} className={`h-[36px] px-4 rounded-full text-[14px] font-secondary transition-colors border flex items-center gap-2 ${type === 'movie' ? 'bg-red-600 text-white border-red-600 font-semibold' : 'bg-white/5 text-white/80 border-white/10 hover:border-white/30 hover:text-white'}`}>
                   <span className="material-symbols-outlined text-[16px]">movie</span> Movies
                 </AnimatedButton>
                 <AnimatedButton onClick={() => updateFilters({ type: 'tv' })} className={`h-[36px] px-4 rounded-full text-[14px] font-secondary transition-colors border flex items-center gap-2 ${type === 'tv' ? 'bg-red-600 text-white border-red-600 font-semibold' : 'bg-white/5 text-white/80 border-white/10 hover:border-white/30 hover:text-white'}`}>
                   <span className="material-symbols-outlined text-[16px]">tv</span> Shows
                 </AnimatedButton>
               </div>
             </div>
             
             <div className="flex items-center">
                <AnimatedButton onClick={() => setFiltersOpen(!filtersOpen)} className={`h-[36px] px-[14px] rounded-full border text-[14px] flex items-center gap-[6px] transition-colors font-secondary ${activeSecondaryFilterCount > 0 ? 'bg-red-600/20 border-red-600 text-white' : 'bg-white/5 border-white/10 text-white/80 hover:text-white hover:border-white/30'}`}>
                   <span className="material-symbols-outlined text-[16px]">tune</span>
                   Filters
                   {activeSecondaryFilterCount > 0 && <span className="w-[6px] h-[6px] rounded-full bg-red-600 ml-1"></span>}
                </AnimatedButton>
             </div>
          </div>

          <AnimatePresence initial={false}>
            {filtersOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: DURATIONS.fast, ease: EASINGS.standard }}
                className="overflow-hidden"
              >
                <div className="pt-4">
                  <LibraryAdvancedFilters filters={libraryFilters} customLists={customLists} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {activeSecondaryFilterCount > 0 && (
            <div className="flex items-center gap-2 pt-4 flex-wrap">
               <AnimatePresence mode="popLayout">
                 {customListIds.map(id => <motion.div layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} key={id} className="px-3 py-1.5 rounded-full bg-white/10 text-[12px] text-white/80 font-secondary border border-white/5 flex items-center gap-1.5">List: {customLists?.find(l => l.id === id)?.name || id} <button onClick={() => updateFilters({ lists: customListIds.filter(x => x !== id) })} className="hover:text-white"><span className="material-symbols-outlined text-[14px]">close</span></button></motion.div>)}
                 {imdbRatingMin && <motion.div layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} key="imdbRatingMin" className="px-3 py-1.5 rounded-full bg-white/10 text-[12px] text-white/80 font-secondary border border-white/5 flex items-center gap-1.5">IMDb: {imdbRatingMin}+ <button onClick={() => updateFilters({ imdbMin: null })} className="hover:text-white"><span className="material-symbols-outlined text-[14px]">close</span></button></motion.div>}
                 {imdbVotesMin && <motion.div layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} key="imdbVotesMin" className="px-3 py-1.5 rounded-full bg-white/10 text-[12px] text-white/80 font-secondary border border-white/5 flex items-center gap-1.5">IMDb Votes: {imdbVotesMin >= 1000000 ? `${imdbVotesMin/1000000}M` : imdbVotesMin >= 1000 ? `${imdbVotesMin/1000}K` : imdbVotesMin}+ <button onClick={() => updateFilters({ imdbVotesMin: null })} className="hover:text-white"><span className="material-symbols-outlined text-[14px]">close</span></button></motion.div>}
                 {tmdbRatingMin && <motion.div layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} key="tmdbRatingMin" className="px-3 py-1.5 rounded-full bg-white/10 text-[12px] text-white/80 font-secondary border border-white/5 flex items-center gap-1.5">TMDB: {tmdbRatingMin}+ <button onClick={() => updateFilters({ tmdbMin: null })} className="hover:text-white"><span className="material-symbols-outlined text-[14px]">close</span></button></motion.div>}
                 {tmdbVotesMin && <motion.div layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} key="tmdbVotesMin" className="px-3 py-1.5 rounded-full bg-white/10 text-[12px] text-white/80 font-secondary border border-white/5 flex items-center gap-1.5">TMDB Votes: {tmdbVotesMin >= 1000000 ? `${tmdbVotesMin/1000000}M` : tmdbVotesMin >= 1000 ? `${tmdbVotesMin/1000}K` : tmdbVotesMin}+ <button onClick={() => updateFilters({ tmdbVotesMin: null })} className="hover:text-white"><span className="material-symbols-outlined text-[14px]">close</span></button></motion.div>}
                 {genres.map(g => <motion.div layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} key={`g-${g}`} className="px-3 py-1.5 rounded-full bg-white/10 text-[12px] text-white/80 font-secondary border border-white/5 flex items-center gap-1.5">{g} <button onClick={() => updateFilters({ genres: genres.filter(x => x !== g) })} className="hover:text-white"><span className="material-symbols-outlined text-[14px]">close</span></button></motion.div>)}
                 {(yearFrom || yearTo) && <motion.div layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} key="year" className="px-3 py-1.5 rounded-full bg-white/10 text-[12px] text-white/80 font-secondary border border-white/5 flex items-center gap-1.5">Year: {yearFrom || '...'} - {yearTo || '...'} <button onClick={() => updateFilters({ yearFrom: null, yearTo: null })} className="hover:text-white"><span className="material-symbols-outlined text-[14px]">close</span></button></motion.div>}
               </AnimatePresence>
               <AnimatedButton onClick={clearAdvancedFilters} className="text-[12px] text-white/50 font-secondary hover:text-white bg-transparent ml-2">Clear all</AnimatedButton>
            </div>
          )}
        </div>

      {/* Main Content */}
      <main className="flex-grow w-full px-8 pb-20 max-w-[1440px] mx-auto">
        <div className="max-w-full mx-auto space-y-8">
          {message && (
            <div className={`glass-effect px-6 py-4 rounded-lg ${message.type === 'error' ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-green-500/20 text-green-300 border border-green-500/30'}`}>
              {message.text}
            </div>
          )}

          {loading && (
            <div className="w-full">
              <LibraryGridSkeleton viewMode={viewMode} />
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="glass-effect rounded-2xl p-12 text-center border border-white/5 bg-white/5">
              <span className="material-symbols-outlined text-6xl text-white/20 mb-4 block">inbox</span>
              <p className="text-white/60 font-secondary text-base">Your library is empty. Search for movies or shows to add them!</p>
            </div>
          )}

          {!loading && items.length > 0 && sortedAndFilteredItems.length === 0 && (
            <div className="glass-effect rounded-2xl p-12 text-center border border-white/5 bg-white/5">
              <span className="material-symbols-outlined text-6xl text-white/20 mb-4 block">search_off</span>
              <p className="text-white/60 font-secondary text-base">No items match your filters.</p>
            </div>
          )}

          {!loading && sortedAndFilteredItems.length > 0 && (
            <LibraryGrid 
              items={sortedAndFilteredItems}
              viewMode={viewMode}
              handleItemClick={handleItemClick}
              handleRemove={handleRemove}
              onQuickActions={handleQuickActions}
              getImdbRating={getImdbRating}
              getImdbVotes={getImdbVotes}
            />
          )}
        </div>
      </main>
      </div>
      </div>

      {/* Mobile View */}
      <div className="block md:hidden">
        <MobileLibraryView
          activePrimaryTab={activePrimaryTab}
          setActivePrimaryTab={setActivePrimaryTab}
          items={items}
          filteredItems={sortedAndFilteredItems}
          loading={loading}
          customLists={customLists}
          selectedListId={customListIds[0] || null}
          setSelectedListId={(id) => updateFilters({ lists: id ? [id] : [] })}
          handleItemClick={handleItemClick}
          handleRemove={handleRemove}
          onQuickActions={handleQuickActions}
          getImdbRating={getImdbRating}
          getImdbVotes={getImdbVotes}
          message={message}
        />
      </div>

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
      />
    </LibraryFiltersContext.Provider>
  );
};

export default LibraryMasterPage;
