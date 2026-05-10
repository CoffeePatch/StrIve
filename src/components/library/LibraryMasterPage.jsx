import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  getLibraryByStatus,
  getLibraryByListId,
  fetchUserLists,
} from '../../util/firestoreService';
import MovieCard from '../movie/Cards/MovieCard';
import TVShowCard from '../tv/TVShowCard';
import Header from '../layout/Header';
import '../../styles/LibraryMasterPage.css';

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
  const [message, setMessage] = useState(null);
  const [viewMode, setViewMode] = useState('grid');

  // Load custom lists on mount
  useEffect(() => {
    if (!user?.uid) return;

    const signal = { cancelled: false };
    loadCustomLists(signal);

    return () => {
      signal.cancelled = true;
    };
  }, [user?.uid]);

  // Load items when tab or filters change
  useEffect(() => {
    if (!user?.uid) return;

    const signal = { cancelled: false };
    loadItems(signal);

    return () => {
      signal.cancelled = true;
    };
  }, [user?.uid, activeTab, selectedListId, sortBy]);

  const loadCustomLists = async (signal) => {
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
  };

  const loadItems = async (signal) => {
    if (!user?.uid) return;

    try {
      setLoading(true);
      let fetchedItems = [];

      if (activeTab === 'watchlist') {
        fetchedItems = await fetchAllByStatus(user.uid, 'plan_to_watch', signal);
      } else if (activeTab === 'watched') {
        fetchedItems = await fetchAllByStatus(user.uid, 'completed', signal);
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
  };

  const fetchAllByStatus = async (userId, status, signal) => {
    const allItems = [];
    let cursor = null;
    let hasMore = true;
    const maxPages = 200;
    let pageCount = 0;

    while (hasMore && pageCount < maxPages) {
      if (signal?.cancelled) break;

      const page = await getLibraryByStatus(userId, status, {
        pageSize: 100,
        cursor,
        includePageInfo: true,
        hydrate: false,
        allowLegacyFallback: false,
      });

      if (signal?.cancelled) break;

      allItems.push(...(page.items || []));

      const nextCursor = page.nextCursor || null;

      if (!!page.hasMore && !nextCursor) {
        console.warn('Library pagination halted: hasMore=true but nextCursor was null');
        break;
      }

      if (nextCursor && cursor && nextCursor.id === cursor.id) {
        console.warn('Library pagination halted: cursor did not advance');
        break;
      }

      hasMore = !!page.hasMore;
      cursor = nextCursor;
      pageCount += 1;

      if (pageCount % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    return allItems;
  };

  const fetchAllByListId = async (userId, listId, signal) => {
    const allItems = [];
    let cursor = null;
    let hasMore = true;
    const maxPages = 200;
    let pageCount = 0;

    while (hasMore && pageCount < maxPages) {
      if (signal?.cancelled) break;

      const page = await getLibraryByListId(userId, listId, {
        pageSize: 100,
        cursor,
        includePageInfo: true,
        hydrate: false,
        allowLegacyFallback: false,
      });

      if (signal?.cancelled) break;

      allItems.push(...(page.items || []));

      const nextCursor = page.nextCursor || null;

      if (!!page.hasMore && !nextCursor) {
        console.warn('Library pagination halted: hasMore=true but nextCursor was null');
        break;
      }

      if (nextCursor && cursor && nextCursor.id === cursor.id) {
        console.warn('Library pagination halted: cursor did not advance');
        break;
      }

      hasMore = !!page.hasMore;
      cursor = nextCursor;
      pageCount += 1;

      if (pageCount % 10 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    return allItems;
  };

  const sortItems = (itemsToSort, sortOption) => {
    const sorted = [...itemsToSort];

    if (sortOption === 'rating-desc') {
      sorted.sort((a, b) => {
        const ratingA = a.imdbRating || 0;
        const ratingB = b.imdbRating || 0;
        return ratingB - ratingA;
      });
    } else if (sortOption === 'rating-asc') {
      sorted.sort((a, b) => {
        const ratingA = a.imdbRating || 0;
        const ratingB = b.imdbRating || 0;
        return ratingA - ratingB;
      });
    } else if (sortOption === 'date') {
      sorted.sort((a, b) => {
        const dateA = new Date(a.dateAdded || 0);
        const dateB = new Date(b.dateAdded || 0);
        return dateB - dateA;
      });
    }

    return sorted;
  };

  const getFilteredItems = () => {
    if (!searchQuery.trim()) {
      return items;
    }
    const query = searchQuery.toLowerCase();
    return items.filter((item) =>
      (item.title || item.name || '').toLowerCase().includes(query)
    );
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
              <span>Watchlist</span>
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
              <span>Watched</span>
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
            <div className="flex items-center gap-4">
              <label className="text-white/70 font-secondary">Select List:</label>
              <select
                value={selectedListId || ''}
                onChange={(e) => setSelectedListId(e.target.value)}
                className="glass-effect px-4 py-2 rounded-lg text-white bg-white/10 border border-white/20 hover:border-white/30 transition-all font-secondary"
              >
                <option value="">-- Choose a list --</option>
                {customLists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name} ({list.items?.length || 0})
                  </option>
                ))}
              </select>
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
                  ? '📭 Your watchlist is empty. Search for movies or shows to add them!'
                  : activeTab === 'watched'
                  ? '👀 You haven\'t marked anything as watched yet.'
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
                      <div className="flex items-start gap-6 glass-effect rounded-xl p-4 hover:bg-white/10 transition-all">
                        {item.poster_path && (
                          <div className="flex-shrink-0 w-24 h-36 rounded-lg overflow-hidden border border-white/10">
                            <img
                              src={
                                item.poster_path.startsWith('http')
                                  ? item.poster_path
                                  : `https://image.tmdb.org/t/p/w342${item.poster_path}`
                              }
                              alt={item.title || item.name}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
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
                          {item.imdbRating && (
                            <div className="flex items-center gap-2 mt-3">
                              <span className="material-symbols-outlined text-yellow-400 text-sm">
                                star
                              </span>
                              <span className="text-yellow-400 font-semibold">
                                {item.imdbRating.toFixed(1)}
                              </span>
                              {item.imdbVotes && (
                                <span className="text-white/40 text-sm">
                                  {(item.imdbVotes / 1000000).toFixed(1)}M votes
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
                      <TVShowCard show={item} vaultMode={true} />
                    ) : (
                      <MovieCard movie={item} vaultMode={true} />
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
