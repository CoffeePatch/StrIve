import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import MobileLibraryView from './MobileLibraryView';
import {
  getLibraryByStatus,
  getLibraryByListId,
  getLibraryItemListIds,
  setLibraryItemListIds,
} from '../../util/firebase/firestoreService';
import { useLists } from "../../domain/lists/useLists";
import { useListMembership } from "../../domain/lists/useListMembership";
import { libraryAdapter } from '../../domain/library/libraryAdapter';
import Header from '../layout/Header';
import '../../styles/LibraryMasterPage.css';
import { exportListCsv } from '../../util/export/exportDownload';
import { toast } from 'react-toastify';
import { useLibraryFilters } from '../../hooks/library/useLibraryFilters';
import LibraryAdvancedFilters from './LibraryAdvancedFilters';
import LibraryGrid from './LibraryGrid';

const LibraryMasterPage = () => {
  const { user } = useSelector((store) => store.user);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const activePrimaryTab = searchParams.get('tab') || 'movies';
  const setActivePrimaryTab = (tab) => {
    setSearchParams(prev => { prev.set('tab', tab); return prev; }, { replace: true });
  };

  const activeTab = searchParams.get('filter') || 'watchlist';
  const setActiveTab = (filter) => {
    setSearchParams(prev => { prev.set('filter', filter); return prev; }, { replace: true });
  };
  
  const sortBy = searchParams.get('sort') || 'rating-desc';
  const setSortBy = (sort) => {
    setSearchParams(prev => { prev.set('sort', sort); return prev; }, { replace: true });
  };

  const [items, setItems] = useState([]);
  const { lists: customLists, loadLists, createNewList, removeList, updateList } = useLists(user?.uid);
  const { addMediaToList, removeMediaFromList } = useListMembership(user?.uid);
  const [selectedListId, setSelectedListId] = useState(null);
  const [loading, setLoading] = useState(false);
  const libraryFilters = useLibraryFilters(items);
  const {
    searchQuery, setSearchQuery,
    filtersOpen, setFiltersOpen,
    filteredItems,
    getImdbRating,
    getImdbVotes
  } = libraryFilters;
  const [message, setMessage] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [listMenuOpen, setListMenuOpen] = useState(false);
  const listMenuRef = React.useRef(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadCustomLists = useCallback(
    async (signal) => {
      if (!user?.uid) return;

      try {
        const lists = await loadLists();

        if (signal?.cancelled) return;

        if (lists && lists.length > 0 && !selectedListId) {
          setSelectedListId(lists[0].id);
        }
      } catch (error) {
        console.error('Error loading custom lists:', error);
      }
    },
    [user?.uid, loadLists, selectedListId]
  );

  const loadItems = useCallback(
    async (signal) => {
      if (!user?.uid) return;

      try {
        if (items.length === 0) {
          setLoading(true);
        }
        let fetchedItems = [];

        if (activeTab === 'watchlist') {
          fetchedItems = await fetchAllByStatus(user.uid, 'Plan to Watch', signal);
        } else if (activeTab === 'watching') {
          fetchedItems = await fetchAllByStatus(user.uid, 'Watching', signal);
        } else if (activeTab === 'watched') {
          fetchedItems = await fetchAllByStatus(user.uid, 'Completed', signal);
        } else if (activeTab === 'custom' && selectedListId) {
          fetchedItems = await fetchAllByListId(user.uid, selectedListId, signal);
        }

        if (signal?.cancelled) return;

        setItems(fetchedItems);
      } catch (error) {
        console.error('Error loading items:', error);
        if (!signal?.cancelled) {
          setMessage({ type: 'error', text: 'Failed to load library items' });
        }
      } finally {
        if (!signal?.cancelled) {
          setLoading(false);
        }
      }
    },
    [user?.uid, activeTab, selectedListId]
  );

  // Load custom lists on mount
  useEffect(() => {
    if (!user?.uid) return;

    const signal = { cancelled: false };
    loadCustomLists(signal);

    return () => {
      signal.cancelled = true;
    };
  }, [user?.uid, loadCustomLists]);

  useEffect(() => {
    if (!listMenuOpen) return;

    const handlePointerDown = (e) => {
      const node = listMenuRef.current;
      if (!node) return;
      if (node.contains(e.target)) return;
      setListMenuOpen(false);
    };

    window.addEventListener('pointerdown', handlePointerDown);
    return () => window.removeEventListener('pointerdown', handlePointerDown);
  }, [listMenuOpen]);

  // Load items when tab or filters change
  useEffect(() => {
    if (!user?.uid) return;

    const signal = { cancelled: false };
    loadItems(signal);

    return () => {
      signal.cancelled = true;
    };
  }, [user?.uid, activeTab, selectedListId, loadItems]);

  const fetchAllByStatus = async (userId, status, signal) => {
    if (signal?.cancelled) return [];

    const items = await getLibraryByStatus(userId, status, {
      hydrate: false,
      includePageInfo: false,
    });

    return Array.isArray(items) ? items : [];
  };

  const fetchAllByListId = async (userId, listId, signal) => {
    if (signal?.cancelled) return [];

    const items = await getLibraryByListId(userId, listId, {
      hydrate: false,
      includePageInfo: false,
    });

    return Array.isArray(items) ? items : [];
  };

  const getAddedTimestamp = (item) => {
    const candidate =
      item?.tracking?.addedAt ||
      item?.addedAt ||
      item?.dateAdded ||
      item?.tracking?.updatedAt ||
      null;

    if (!candidate) return 0;

    if (typeof candidate === 'number') return candidate;

    if (typeof candidate?.toDate === 'function') {
      return candidate.toDate().getTime();
    }

    const parsed = new Date(candidate).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const sortItems = (itemsToSort, sortOption) => {
    const sorted = [...itemsToSort];

    if (sortOption === 'rating-desc') {
      sorted.sort((a, b) => {
        const ratingA = Number(a?.ratings?.imdbScore ?? a?.imdbRating) || 0;
        const ratingB = Number(b?.ratings?.imdbScore ?? b?.imdbRating) || 0;
        return ratingB - ratingA;
      });
    } else if (sortOption === 'rating-asc') {
      sorted.sort((a, b) => {
        const ratingA = Number(a?.ratings?.imdbScore ?? a?.imdbRating) || 0;
        const ratingB = Number(b?.ratings?.imdbScore ?? b?.imdbRating) || 0;
        return ratingA - ratingB;
      });
    } else if (sortOption === 'date') {
      sorted.sort((a, b) => {
        const dateA = getAddedTimestamp(a);
        const dateB = getAddedTimestamp(b);
        return dateB - dateA;
      });
    }

    return sorted;
  };

  const sortedAndFilteredItems = useMemo(() => {
    return sortItems(filteredItems, sortBy);
  }, [filteredItems, sortBy]);

  useEffect(() => {
    libraryFilters.clearAdvancedFilters();
  }, [activeTab, selectedListId, libraryFilters]);

  const handleItemClick = (item) => {
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
  };

  const getTabLabel = useCallback(() => {
    if (activeTab === 'custom') {
      const list = customLists.find((l) => l.id === selectedListId);
      return list?.name || 'list';
    }
    if (activeTab === 'watching') return 'Watching';
    if (activeTab === 'watched') return 'Completed';
    return 'Plan to Watch';
  }, [activeTab, customLists, selectedListId]);

  const handleRemove = useCallback(
    async (item) => {
      if (!user?.uid) return;

      const tabAtRemove = activeTab;
      const listIdAtRemove = selectedListId;
      const labelAtRemove = getTabLabel();
      const statusToRestore =
        tabAtRemove === 'watchlist'
          ? 'Plan to Watch'
          : tabAtRemove === 'watching'
            ? 'Watching'
            : tabAtRemove === 'watched'
              ? 'Completed'
              : null;

      setItems((prev) => prev.filter((x) => !(String(x.id) === String(item.id) && (x.media_type || x.mediaType) === (item.media_type || item.mediaType))));

      try {
        if (tabAtRemove === 'custom') {
          if (!listIdAtRemove) throw new Error('Missing listId');
          await removeMediaFromList(listIdAtRemove, item.id);
        } else {
          // System status tabs: clear status
          await libraryAdapter.updateLibraryStatus(user.uid, item, null);
        }
      } catch (error) {
        console.error('Remove failed:', error);
        setItems((prev) => sortItems([...prev, item], sortBy));
        toast.error('Failed to remove item');
        return;
      }

      toast(
        ({ closeToast }) => (
          <div className="flex items-center gap-3">
            <span className="text-sm">Removed from {labelAtRemove}</span>
            <button
              className="text-sm underline"
              onClick={async () => {
                try {
                  if (tabAtRemove === 'custom') {
                    if (!listIdAtRemove) throw new Error('Missing listId');
                    await addMediaToList(listIdAtRemove, item);
                  } else {
                    await libraryAdapter.updateLibraryStatus(user.uid, item, statusToRestore);
                  }

                  setItems((prev) => sortItems([...prev, item], sortBy));
                  closeToast?.();
                } catch (undoErr) {
                  console.error('Undo failed:', undoErr);
                  toast.error('Undo failed');
                }
              }}
              aria-label="Undo remove"
            >
              Undo
            </button>
          </div>
        ),
        { autoClose: 5000 }
      );
    },
    [user?.uid, activeTab, selectedListId, getTabLabel, sortBy]
  );


  return (
    <>
      {/* Desktop/Tablet View */}
      <div className="hidden md:flex min-h-screen premium-page flex-col">
      <Header />

      {/* Hero Section */}
      <div className="pt-24 pb-12 px-10">
        <div className="max-w-full mx-auto">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <span className="material-symbols-outlined text-6xl gradient-accent leading-none shrink-0">
                  collections
                </span>
                <h1 className="font-display text-5xl lg:text-6xl font-bold gradient-text">
                  My Library
                </h1>
              </div>
              <p className="text-white/60 font-secondary text-lg">
                {sortedAndFilteredItems.length} item{sortedAndFilteredItems.length !== 1 ? 's' : ''} shown
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {/* Import Button */}
              <button
                onClick={() => navigate('/import')}
                className="px-4 py-2 rounded-lg transition-all flex items-center gap-2 bg-black/40 text-white/90 border border-white/20 hover:border-red-500/50 hover:bg-black/60"
                title="Import lists from CSV"
              >
                <span className="material-symbols-outlined text-xl">upload</span>
                <span className="font-secondary text-sm hidden sm:inline">Import</span>
              </button>
              {/* View Mode Toggle */}
              <div className="glass-effect rounded-xl p-1 flex gap-1">
                <button
                  onClick={() => setViewMode('bookshelf')}
                  className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                    viewMode === 'bookshelf'
                      ? 'bg-red-600 text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">view_agenda</span>
                  <span className="font-secondary text-sm hidden sm:inline">Wide</span>
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                    viewMode === 'grid'
                      ? 'bg-red-600 text-white'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">grid_view</span>
                  <span className="font-secondary text-sm hidden sm:inline">Grid</span>
                </button>
              </div>

              {/* Sort Dropdown */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="glass-effect px-4 py-2 rounded-lg text-white/90 bg-white/10 border border-white/20 hover:border-white/30 transition-all font-secondary text-sm"
              >
                <option value="rating-desc">IMDb: High to Low</option>
                <option value="rating-asc">IMDb: Low to High</option>
                <option value="date">Newest Added</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-grow w-full px-10 pb-20">
        <div className="max-w-full mx-auto space-y-8">
          {/* Message Display */}
          {message && (
            <div
              className={`glass-effect px-6 py-4 rounded-lg ${
                message.type === 'error'
                  ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                  : 'bg-green-500/20 text-green-300 border border-green-500/30'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Edit Modal */}
          {editOpen && (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
              <div className="bg-gray-900 rounded-xl w-full max-w-2xl">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-white">Edit List</h2>
                  <button onClick={() => setEditOpen(false)} className="text-gray-400 hover:text-white" disabled={savingEdit}>
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
                    <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none" disabled={savingEdit} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                    <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none min-h-[100px]" disabled={savingEdit} />
                  </div>
                </div>

                <div className="p-4 border-t border-gray-700 flex justify-end gap-3">
                  <button className="px-4 py-2 rounded-lg bg-gray-800 text-white" onClick={() => setEditOpen(false)} disabled={savingEdit}>Cancel</button>
                  <button className={`px-4 py-2 rounded-lg bg-red-600 text-white ${savingEdit ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={async () => {
                    if (!user?.uid || !selectedListId) return;
                    setSavingEdit(true);
                    try {
                      await updateList(selectedListId, { name: editTitle, description: editDescription });
                      await loadCustomLists({ cancelled: false });
                      toast.success('List updated');
                      setEditOpen(false);
                    } catch (e) {
                      console.error('Update failed', e);
                      toast.error('Failed to update list');
                    } finally {
                      setSavingEdit(false);
                    }
                  }} disabled={savingEdit}>{savingEdit ? 'Saving...' : 'Save'}</button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Modal */}
          {deleteOpen && (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
              <div className="bg-gray-900 rounded-xl w-full max-w-2xl">
                <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                  <h2 className="text-xl font-semibold text-white">Delete List</h2>
                  <button onClick={() => setDeleteOpen(false)} className="text-gray-400 hover:text-white" disabled={deleting}>
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div className="p-4">
                  <p className="text-white">Are you sure? This cannot be undone.</p>
                  <p className="text-gray-400 mt-2">This will permanently delete the list "{customLists.find(l => l.id === selectedListId)?.name || 'Selected List'}".</p>
                </div>

                <div className="p-4 border-t border-gray-700 flex justify-end gap-3">
                  <button className="px-4 py-2 rounded-lg bg-gray-800 text-white" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancel</button>
                  <button className={`px-4 py-2 rounded-lg bg-red-600 text-white ${deleting ? 'opacity-50 cursor-not-allowed' : ''}`} onClick={async () => {
                    if (!user?.uid || !selectedListId) return;
                    setDeleting(true);
                    try {
                      await removeList(selectedListId);
                      await loadCustomLists({ cancelled: false });
                      setSelectedListId(null);
                      toast.success('List deleted and cleaned');
                      setDeleteOpen(false);
                    } catch (e) {
                      console.error('Delete failed', e);
                      toast.error('Failed to delete list');
                    } finally {
                      setDeleting(false);
                    }
                  }} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</button>
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex flex-wrap gap-4 border-b border-white/10 pb-4">
            <button
              onClick={() => {
                setActiveTab('watchlist');
                setSearchQuery('');
              }}
              className={`pb-2 px-2 font-secondary font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'watchlist'
                  ? 'text-red-600 border-b-2 border-red-600'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined">bookmark</span>
              <span>Plan to Watch</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('watching');
                setSearchQuery('');
              }}
              className={`pb-2 px-2 font-secondary font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'watching'
                  ? 'text-red-600 border-b-2 border-red-600'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined">play_circle</span>
              <span>Watching</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('watched');
                setSearchQuery('');
              }}
              className={`pb-2 px-2 font-secondary font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'watched'
                  ? 'text-red-600 border-b-2 border-red-600'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined">check_circle</span>
              <span>Completed</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('custom');
                setSearchQuery('');
              }}
              className={`pb-2 px-2 font-secondary font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'custom'
                  ? 'text-red-600 border-b-2 border-red-600'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined">playlist_add</span>
              <span>Custom Lists</span>
            </button>
          </div>

          {/* Custom List Selector */}
          {activeTab === 'custom' && (
            <div className="flex items-center w-full gap-3 justify-between">
              <div className="flex items-center gap-4 shrink-0">
                <label className="text-white/70 font-secondary">Select List:</label>
                <select
                  value={selectedListId || ''}
                  onChange={(e) => setSelectedListId(e.target.value)}
                  className="glass-effect px-4 py-2 rounded-lg text-white bg-white/10 border border-white/20 hover:border-white/30 transition-all font-secondary"
                >
                  <option value="">-- Choose a list --</option>
                  {customLists.map((list) => {
                    const count = Array.isArray(list.items) ? list.items.length : undefined;
                    return (
                      <option key={list.id} value={list.id}>
                        {list.name}{count != null && count > 0 ? ` (${count})` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {filtersOpen && <LibraryAdvancedFilters filters={libraryFilters} inline={true} />}

              {/* Filters toggle and three-dots menu */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  className={`p-1 transition-all flex items-center justify-center ${
                    filtersOpen
                      ? 'text-white'
                      : 'text-white/80 hover:text-white'
                  }`}
                  onClick={() => setFiltersOpen((v) => !v)}
                  aria-label="Toggle advanced filters"
                  title="Filters"
                >
                  <span className={`material-symbols-outlined text-base transition-transform ${filtersOpen ? '-rotate-90' : ''}`}>
                    chevron_left
                  </span>
                </button>

                <div className="relative" ref={listMenuRef}>
                  <button
                    className="p-1 text-white/80 hover:text-white focus:outline-none"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!selectedListId) return toast.info('Select a list first');
                      const list = customLists.find((l) => l.id === selectedListId);
                      setEditTitle(list?.name || '');
                      setEditDescription(list?.description || '');
                      setListMenuOpen((v) => !v);
                    }}
                    aria-label="List actions"
                  >
                    <span className="material-symbols-outlined">more_vert</span>
                  </button>

                  {listMenuOpen && (
                    <div className="absolute right-0 mt-2 w-44 glass-effect border border-white/10 rounded-lg overflow-hidden z-40">
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/5"
                      onClick={() => {
                        setListMenuOpen(false);
                        setEditOpen(true);
                      }}
                    >
                      Edit List
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/5"
                      onClick={() => {
                        setListMenuOpen(false);
                        setDeleteOpen(true);
                      }}
                    >
                      Delete List
                    </button>
                    <button
                      className="w-full text-left px-4 py-2 text-sm text-white hover:bg-white/5"
                      onClick={async () => {
                        setListMenuOpen(false);
                        if (!selectedListId) return toast.info('Select a list first');
                        try {
                          const list = customLists.find((l) => l.id === selectedListId);
                          await exportListCsv(selectedListId, list?.name);
                        } catch (e) {
                          console.error('Export failed', e);
                          toast.error('Export failed');
                        }
                      }}
                    >
                      Export List
                    </button>
                  </div>
                )}
                </div>
              </div>
            </div>
          )}

          {activeTab !== 'custom' && (
            <div className="flex justify-end">
              <button
                className={`glass-effect px-2.5 py-2 rounded-lg border transition-all flex items-center justify-center ${
                  filtersOpen
                    ? 'text-white border-red-500/60 bg-red-600/20'
                    : 'text-white/80 border-white/15 hover:border-white/30 hover:text-white'
                }`}
                onClick={() => setFiltersOpen((v) => !v)}
                aria-label="Toggle advanced filters"
                title="Filters"
              >
                <span className={`material-symbols-outlined text-base transition-transform ${filtersOpen ? '-rotate-90' : ''}`}>
                  chevron_left
                </span>
              </button>
            </div>
          )}

          {activeTab !== 'custom' && filtersOpen && (
            <LibraryAdvancedFilters filters={libraryFilters} inline={false} />
          )}

          {/* Search Filter */}
          <div className="glass-effect rounded-xl px-4 py-3 flex items-center gap-3 bg-white/5 border border-white/10">
            <span className="material-symbols-outlined text-white/60">search</span>
            <input
              type="text"
              placeholder="Search in your library..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-white placeholder-white/40 focus:outline-none font-secondary"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-white/60 hover:text-white transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            )}
          </div>

          {/* Loading State */}
          {loading && (
            <div className="text-center py-20">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-white/20 border-t-red-600 mx-auto mb-4"></div>
              <p className="text-white/60 font-secondary">Loading your library...</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && items.length === 0 && (
            <div className="glass-effect rounded-2xl p-12 text-center">
              <span className="material-symbols-outlined text-6xl text-white/40 mb-4 block">
                inbox
              </span>
              <p className="text-white/60 font-secondary text-lg">
                {activeTab === 'watchlist'
                  ? '📭 Your Plan to Watch list is empty. Search for movies or shows to add them!'
                  : activeTab === 'watching'
                    ? '📺 You\'re not currently watching anything.'                  : activeTab === 'watched'
                  ? '👀 You haven\'t marked anything as completed yet.'
                  : '🎬 This list is empty. Add items to get started!'}
              </p>
            </div>
          )}

          {/* No Search Results */}
          {!loading && items.length > 0 && sortedAndFilteredItems.length === 0 && (
            <div className="glass-effect rounded-2xl p-12 text-center">
              <span className="material-symbols-outlined text-6xl text-white/40 mb-4 block">
                search_off
              </span>
              <p className="text-white/60 font-secondary text-lg">
                🔍 No items match "{searchQuery}"
              </p>
            </div>
          )}

          {/* Items Grid */}
          {!loading && sortedAndFilteredItems.length > 0 && (
            <LibraryGrid 
              items={sortedAndFilteredItems}
              viewMode={viewMode}
              handleItemClick={handleItemClick}
              handleRemove={handleRemove}
              getImdbRating={getImdbRating}
              getImdbVotes={getImdbVotes}
            />
          )}
        </div>
      </main>
      </div>

      {/* Mobile View */}
      <div className="block md:hidden">
        <MobileLibraryView
          activePrimaryTab={activePrimaryTab}
          setActivePrimaryTab={setActivePrimaryTab}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          sortBy={sortBy}
          setSortBy={setSortBy}
          items={items}
          filteredItems={sortedAndFilteredItems}
          loading={loading}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          customLists={customLists}
          selectedListId={selectedListId}
          setSelectedListId={setSelectedListId}
          handleItemClick={handleItemClick}
          handleRemove={handleRemove}
          getImdbRating={getImdbRating}
          getImdbVotes={getImdbVotes}
          message={message}
        />
      </div>
    </>
  );
};

export default LibraryMasterPage;
