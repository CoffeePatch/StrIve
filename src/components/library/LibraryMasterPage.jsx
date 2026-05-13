import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  getLibraryByStatus,
  getLibraryByListId,
  getLibraryItemListIds,
  setLibraryItemListIds,
  setLibraryItemStatus,
  updateLibraryItem,
  toggleCustomListTag,
  addItemToCustomList,
  removeItemFromCustomList,
  fetchUserLists,
} from '../../util/firebase/firestoreService';
import MovieCard from '../movie/Cards/MovieCard';
import TVShowCard from '../tv/TVShowCard';
import Header from '../layout/Header';
import '../../styles/LibraryMasterPage.css';
import { updateCustomList, deleteCustomList, removeListIdFromAllLibraryItems } from '../../util/firebase/firestoreService';
import { exportListCsv } from '../../util/export/exportDownload';
import { toast } from 'react-toastify';

const LibraryMasterPage = () => {
  const { user } = useSelector((store) => store.user);
  const navigate = useNavigate();
  
  const [activeTab, setActiveTab] = useState('watchlist');
  const [items, setItems] = useState([]);
  const [customLists, setCustomLists] = useState([]);
  const [selectedListId, setSelectedListId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating-desc');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [imdbFilter, setImdbFilter] = useState('all');
  const [imdbVotesFilter, setImdbVotesFilter] = useState('all');
  const [tmdbFilter, setTmdbFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [genreFilter, setGenreFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
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
        const lists = await fetchUserLists(user.uid);

        if (signal?.cancelled) return;

        setCustomLists(lists || []);
        if (lists && lists.length > 0 && !selectedListId) {
          setSelectedListId(lists[0].id);
        }
      } catch (error) {
        console.error('Error loading custom lists:', error);
      }
    },
    [user?.uid, selectedListId]
  );

  const loadItems = useCallback(
    async (signal) => {
      if (!user?.uid) return;

      try {
        setLoading(true);
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

        // Apply sorting
        const sorted = sortItems(fetchedItems, sortBy);
        setItems(sorted);
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
    [user?.uid, activeTab, selectedListId, sortBy]
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
  }, [user?.uid, activeTab, selectedListId, sortBy, loadItems]);

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

  const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const getItemYear = (item) => {
    if (item.releaseDate) {
      const dateStr = typeof item.releaseDate === 'string' ? item.releaseDate : String(item.releaseDate);
      const yearMatch = dateStr.match(/\d{4}/);
      if (yearMatch) return yearMatch[0];
    }
    return null;
  };
  const getTmdbRating = (item) => toNumber(item?.ratings?.tmdbScore ?? item.vote_average);

  const getImdbRating = (item) => toNumber(item?.ratings?.imdbScore ?? item.imdbRating);

  const getImdbVotes = (item) => toNumber(item?.ratings?.imdbVotes ?? item.imdbVotes);

  const getItemGenres = (item) => {
    return Array.isArray(item.genres) ? item.genres : [];
  };

  const standardGenres = [
    'Action',
    'Adventure',
    'Animation',
    'Comedy',
    'Crime',
    'Documentary',
    'Drama',
    'Family',
    'Fantasy',
    'History',
    'Horror',
    'Music',
    'Mystery',
    'Romance',
    'Science Fiction',
    'Thriller',
    'War',
    'Western',
  ];

  const availableYears = useMemo(() => {
    const yearSet = new Set();
    items.forEach((item) => {
      const year = getItemYear(item);
      if (year) yearSet.add(year);
    });
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [items]);

  const clearAdvancedFilters = useCallback(() => {
    setImdbFilter('all');
    setImdbVotesFilter('all');
    setTmdbFilter('all');
    setTypeFilter('all');
    setGenreFilter('all');
    setYearFilter('all');
  }, []);

  useEffect(() => {
    clearAdvancedFilters();
  }, [activeTab, selectedListId, clearAdvancedFilters]);

  const matchesScoreBucket = (score, bucket) => {
    if (bucket === 'all') return true;
    if (score == null) return false;
    if (bucket === '9plus') return score >= 9;
    if (bucket === '8plus') return score >= 8;
    if (bucket === '7plus') return score >= 7;
    if (bucket === '6plus') return score >= 6;
    if (bucket === 'below6') return score < 6;
    return true;
  };

  const matchesVotesBucket = (votes, bucket) => {
    if (bucket === 'all') return true;
    if (votes == null) return false;
    if (bucket === '1000plus') return votes >= 1000;
    if (bucket === '10000plus') return votes >= 10000;
    if (bucket === '50000plus') return votes >= 50000;
    if (bucket === '100000plus') return votes >= 100000;
    if (bucket === '150000plus') return votes >= 150000;
    if (bucket === '500000plus') return votes >= 500000;
    if (bucket === '1000000plus') return votes >= 1000000;
    return true;
  };

  const getFilteredItems = () => {
    const query = searchQuery.trim().toLowerCase();

    return items.filter((item) => {
      const title = (item.title || item.name || '').toLowerCase();
      if (query && !title.includes(query)) return false;

      const imdb = getImdbRating(item);
      if (!matchesScoreBucket(imdb, imdbFilter)) return false;

      const imdbVotes = getImdbVotes(item);
      if (!matchesVotesBucket(imdbVotes, imdbVotesFilter)) return false;

      const tmdb = getTmdbRating(item);
      if (!matchesScoreBucket(tmdb, tmdbFilter)) return false;

      // Map filter values to Firestore media_type values
      if (typeFilter !== 'all') {
        const itemMediaType = (item.media_type || item.mediaType || '').toLowerCase();
        const firestoreType = typeFilter === 'series' ? 'tv' : typeFilter;
        if (itemMediaType !== firestoreType) return false;
      }

      const itemYear = getItemYear(item);
      if (yearFilter !== 'all' && itemYear < parseInt(yearFilter)) return false;

      if (genreFilter !== 'all') {
        const genres = getItemGenres(item).map((g) => g.toLowerCase());
        if (!genres.includes(genreFilter.toLowerCase())) return false;
      }

      return true;
    });
  };

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

          await removeItemFromCustomList(user.uid, listIdAtRemove, item.id);

          const currentListIds = await getLibraryItemListIds(user.uid, item);
          const nextListIds = (currentListIds || []).filter((id) => id !== listIdAtRemove);
          await setLibraryItemListIds(user.uid, item, nextListIds);
        } else {
          // System status tabs: clear status
          await setLibraryItemStatus(user.uid, item, null);
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

                    await addItemToCustomList(user.uid, listIdAtRemove, item);
                    const currentListIds = await getLibraryItemListIds(user.uid, item);
                    const restored = Array.isArray(currentListIds)
                      ? (currentListIds.includes(listIdAtRemove)
                          ? currentListIds
                          : [...currentListIds, listIdAtRemove])
                      : [listIdAtRemove];
                    await setLibraryItemListIds(user.uid, item, restored);
                  } else {
                    await setLibraryItemStatus(user.uid, item, statusToRestore);
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

  const filteredItems = getFilteredItems();

  return (
    <div className="min-h-screen premium-page flex flex-col">
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
                {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} shown
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
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
                      await updateCustomList(user.uid, selectedListId, { name: editTitle, description: editDescription });
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
                      await deleteCustomList(user.uid, selectedListId);
                      // Client-side cleanup
                      await removeListIdFromAllLibraryItems(user.uid, selectedListId);
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

              {filtersOpen && (
                <div className="overflow-x-auto flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-max">
                    <span className="material-symbols-outlined text-white/60 text-base">tune</span>

                    <select
                      value={imdbFilter}
                      onChange={(e) => setImdbFilter(e.target.value)}
                      className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-500/60"
                      title="IMDb Rating"
                    >
                      <option value="all">IMDb: All</option>
                      <option value="9plus">IMDb: 9+</option>
                      <option value="8plus">IMDb: 8+</option>
                      <option value="7plus">IMDb: 7+</option>
                      <option value="6plus">IMDb: 6+</option>
                      <option value="below6">IMDb: Below 6</option>
                    </select>

                    <select
                      value={imdbVotesFilter}
                      onChange={(e) => setImdbVotesFilter(e.target.value)}
                      className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-500/60"
                      title="IMDb Votes"
                    >
                      <option value="all">Votes: All</option>
                      <option value="1000plus">1K+ votes</option>
                      <option value="10000plus">10K+ votes</option>
                      <option value="50000plus">50K+ votes</option>
                      <option value="100000plus">100K+ votes</option>
                      <option value="150000plus">150K+ votes</option>
                      <option value="500000plus">500K+ votes</option>
                      <option value="1000000plus">1M+ votes</option>
                    </select>

                    <select
                      value={tmdbFilter}
                      onChange={(e) => setTmdbFilter(e.target.value)}
                      className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-500/60"
                      title="TMDB Rating"
                    >
                      <option value="all">TMDB: All</option>
                      <option value="9plus">TMDB: 9+</option>
                      <option value="8plus">TMDB: 8+</option>
                      <option value="7plus">TMDB: 7+</option>
                      <option value="6plus">TMDB: 6+</option>
                      <option value="below6">TMDB: Below 6</option>
                    </select>

                    <select
                      value={typeFilter}
                      onChange={(e) => setTypeFilter(e.target.value)}
                      className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-500/60"
                      title="Type"
                    >
                      <option value="all">Type: All</option>
                      <option value="movie">Movie</option>
                      <option value="series">Series</option>
                    </select>

                    <select
                      value={genreFilter}
                      onChange={(e) => setGenreFilter(e.target.value)}
                      className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-500/60"
                      title="Genres"
                    >
                      <option value="all">Genres: All</option>
                      {standardGenres.map((genre) => (
                        <option key={genre} value={genre}>
                          {genre}
                        </option>
                      ))}
                    </select>

                    <select
                      value={yearFilter}
                      onChange={(e) => setYearFilter(e.target.value)}
                      className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-500/60"
                      title="Years"
                    >
                      <option value="all">Years: All</option>
                      {availableYears.map((year) => (
                        <option key={year} value={String(year)}>
                          {year}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={clearAdvancedFilters}
                      className="px-2.5 py-1.5 rounded-lg border border-white/15 text-white/70 hover:text-white hover:border-white/30 text-xs transition-colors"
                      title="Clear filters"
                    >
                      <span className="material-symbols-outlined text-sm">restart_alt</span>
                    </button>
                  </div>
                </div>
              )}

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
            <div className="glass-effect rounded-xl px-3 py-2 border border-white/10 bg-white/5 overflow-x-auto">
              <div className="flex items-center gap-2 min-w-max">
                <span className="material-symbols-outlined text-white/60 text-base">tune</span>

                <select
                  value={imdbFilter}
                  onChange={(e) => setImdbFilter(e.target.value)}
                  className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-500/60"
                  title="IMDb Rating"
                >
                  <option value="all">IMDb: All</option>
                  <option value="9plus">IMDb: 9+</option>
                  <option value="8plus">IMDb: 8+</option>
                  <option value="7plus">IMDb: 7+</option>
                  <option value="6plus">IMDb: 6+</option>
                  <option value="below6">IMDb: Below 6</option>
                </select>

                <select
                  value={imdbVotesFilter}
                  onChange={(e) => setImdbVotesFilter(e.target.value)}
                  className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-500/60"
                  title="IMDb Votes"
                >
                  <option value="all">Votes: All</option>
                  <option value="1000plus">1K+ votes</option>
                  <option value="10000plus">10K+ votes</option>
                  <option value="50000plus">50K+ votes</option>
                  <option value="100000plus">100K+ votes</option>
                  <option value="150000plus">150K+ votes</option>
                  <option value="500000plus">500K+ votes</option>
                  <option value="1000000plus">1M+ votes</option>
                </select>

                <select
                  value={tmdbFilter}
                  onChange={(e) => setTmdbFilter(e.target.value)}
                  className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-500/60"
                  title="TMDB Rating"
                >
                  <option value="all">TMDB: All</option>
                  <option value="9plus">TMDB: 9+</option>
                  <option value="8plus">TMDB: 8+</option>
                  <option value="7plus">TMDB: 7+</option>
                  <option value="6plus">TMDB: 6+</option>
                  <option value="below6">TMDB: Below 6</option>
                </select>

                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-500/60"
                  title="Type"
                >
                  <option value="all">Type: All</option>
                  <option value="movie">Movie</option>
                  <option value="series">Series</option>
                </select>

                <select
                  value={genreFilter}
                  onChange={(e) => setGenreFilter(e.target.value)}
                  className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-500/60"
                  title="Genres"
                >
                  <option value="all">Genres: All</option>
                  {standardGenres.map((genre) => (
                    <option key={genre} value={genre}>
                      {genre}
                    </option>
                  ))}
                </select>

                <select
                  value={yearFilter}
                  onChange={(e) => setYearFilter(e.target.value)}
                  className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-500/60"
                  title="Years"
                >
                  <option value="all">Years: All</option>
                  {availableYears.map((year) => (
                    <option key={year} value={String(year)}>
                      {year}
                    </option>
                  ))}
                </select>

                <button
                  onClick={clearAdvancedFilters}
                  className="px-2.5 py-1.5 rounded-lg border border-white/15 text-white/70 hover:text-white hover:border-white/30 text-xs transition-colors"
                  title="Clear filters"
                >
                  <span className="material-symbols-outlined text-sm">restart_alt</span>
                </button>
              </div>
            </div>
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
          {!loading && items.length > 0 && filteredItems.length === 0 && (
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
          {!loading && filteredItems.length > 0 && (
            <div
              className={
                viewMode === 'bookshelf'
                  ? 'space-y-8'
                  : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6'
              }
            >
              {viewMode === 'bookshelf' ? (
                <div className="space-y-6">
                  {filteredItems.map((item) => (
                    <div
                      key={`${item.media_type}-${item.id}`}
                      onClick={() => handleItemClick(item)}
                      className="cursor-pointer group"
                    >
                      <div className="flex items-start gap-6 glass-effect rounded-xl p-4 hover:bg-white/10 transition-all relative">
                        {item.poster_path && (
                          <div className="flex-shrink-0 w-24 h-36 rounded-lg overflow-hidden border border-white/10 relative group">
                            <img
                              src={
                                item.poster_path.startsWith('http')
                                  ? item.poster_path
                                  : `https://image.tmdb.org/t/p/w342${item.poster_path}`
                              }
                              alt={item.title || item.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            {/* Trash button on bookshelf view */}
                            <button
                              className="absolute top-1 left-1 p-1 opacity-100 text-yellow-400 hover:text-red-500 transition-colors z-10"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemove(item);
                              }}
                              aria-label="Remove from list"
                            >
                              <span className="material-symbols-outlined text-xs">delete</span>
                            </button>
                          </div>
                        )}
                        <div className="flex-1">
                          <h3 className="text-white font-semibold text-lg font-secondary group-hover:text-red-600 transition-colors">
                            {item.title || item.name}
                          </h3>
                          <p className="text-white/60 text-sm mt-1">
                            {(item.release_date || item.first_air_date)?.split('-')[0]} •{' '}
                            {item.media_type === 'tv' ? 'Series' : 'Film'}
                          </p>
                          {getImdbRating(item) && (
                            <div className="flex items-center gap-2 mt-3">
                              <span className="material-symbols-outlined text-yellow-400 text-sm">
                                star
                              </span>
                              <span className="text-yellow-400 font-semibold">
                                {getImdbRating(item).toFixed(1)}
                              </span>
                              {getImdbVotes(item) && (
                                <span className="text-white/40 text-sm">
                                  {(getImdbVotes(item) / 1000000).toFixed(1)}M votes
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                filteredItems.map((item) => (
                  <div
                    key={`${item.media_type}-${item.id}`}
                    onClick={() => handleItemClick(item)}
                    className="cursor-pointer group"
                  >
                    {item.media_type === 'tv' ? (
                      <TVShowCard show={item} vaultMode={true} onRemove={() => handleRemove(item)} />
                    ) : (
                      <MovieCard movie={item} vaultMode={true} onRemove={() => handleRemove(item)} />
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default LibraryMasterPage;
