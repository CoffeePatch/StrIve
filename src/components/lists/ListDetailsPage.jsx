import React, { useEffect, useCallback, useState, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useParams, useLocation } from "react-router-dom";
import useRequireAuth from "../../hooks/common/useRequireAuth";
import { fetchActiveList, removeItem } from "../../util/listsSlice";
import MovieCard from "../movie/Cards/MovieCard";
import Header from "../layout/Header";
import { exportListCsv } from "../../util/exportDownload";
import manualEnrichmentService from "../../services/enrichment/manualEnrichmentService";

const ListDetailsPage = () => {
  const dispatch = useDispatch();
  const user = useRequireAuth();
  const { listId } = useParams();
  const location = useLocation();
  const { details, items, status, error } = useSelector(
    (state) => state.lists.activeList
  );
  const [successMessage, setSuccessMessage] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [sortType, setSortType] = useState("dateAddedDesc");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Enrichment state
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState({ current: 0, total: 0 });
  const [enrichedItems, setEnrichedItems] = useState(new Map());

  useEffect(() => {
    if (user && listId) {
      dispatch(fetchActiveList({ userId: user.uid, listId }));
    }
  }, [dispatch, user, listId]);

  useEffect(() => {
    if (location.state?.importSuccess) {
      const count = location.state.importSuccess;
      const msg =
        location.state.message || `${count} items successfully imported`;
      setSuccessMessage(msg);
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [location.state]);

  const handleRemoveItem = async (item) => {
    if (user && listId) {
      try {
        await dispatch(
          removeItem({ userId: user.uid, listId, mediaId: item.id })
        ).unwrap();
      } catch (err) {
        console.error("Failed to remove item:", err);
      }
    }
  };

  const [exporting, setExporting] = useState(false);
  const handleExport = useCallback(async () => {
    if (!user || !listId) return;
    try {
      setExporting(true);
      await exportListCsv(listId, details?.name);
    } finally {
      setExporting(false);
    }
  }, [user, listId, details]);

  // Handle manual enrichment
  const handleEnrichList = useCallback(async () => {
    if (!user || !listId || !items || items.length === 0) return;
    
    setIsEnriching(true);
    setEnrichProgress({ current: 0, total: items.length });
    setEnrichedItems(new Map());

    await manualEnrichmentService.enrichList(
      user.uid,
      listId,
      items,
      // onProgress callback
      (currentIndex, total, item, updates) => {
        setEnrichProgress({ current: currentIndex + 1, total });
        
        if (updates.status === 'success') {
          // Store the enriched data for live updates
          setEnrichedItems(prev => {
            const newMap = new Map(prev);
            newMap.set(item.id, {
              imdb_rating: updates.imdb_rating,
              tmdb_rating: updates.tmdb_rating,
              vote_average: updates.vote_average,
            });
            return newMap;
          });
        }
      },
      // onComplete callback
      (successCount, failCount) => {
        setIsEnriching(false);
        setSuccessMessage(
          `Enrichment complete! ${successCount} succeeded, ${failCount} failed.`
        );
        
        // Refresh the list to show updated data
        setTimeout(() => {
          dispatch(fetchActiveList({ userId: user.uid, listId }));
        }, 1000);
        
        setTimeout(() => setSuccessMessage(null), 5000);
      }
    );
  }, [user, listId, items, dispatch]);

  const filteredAndSortedItems = useMemo(() => {
    if (!items) return [];

    let filtered = [...items];

    // Search filter
    if (searchQuery.trim()) {
      filtered = filtered.filter((item) => {
        const title = (item.title || item.name || "").toLowerCase();
        return title.includes(searchQuery.toLowerCase());
      });
    }

    // Type filter
    if (filterType !== "all") {
      filtered = filtered.filter((item) => {
        const itemType =
          item.media_type || (item.first_air_date ? "tv" : "movie");
        return itemType === filterType;
      });
    }

    // Sorting
    if (sortType === "dateAddedDesc") {
      filtered.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
    } else if (sortType === "titleAsc") {
      filtered.sort((a, b) =>
        (a.title || a.name).localeCompare(b.title || b.name)
      );
    } else if (sortType === "voteAverageDesc") {
      filtered.sort((a, b) => b.vote_average - a.vote_average);
    }

    return filtered;
  }, [items, filterType, sortType, searchQuery]);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Header />

      {status === "loading" && (
        <div className="flex-grow flex items-center justify-center pt-32">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-gray-800 border-t-red-600 mx-auto mb-4"></div>
            <p className="text-gray-400">Loading list details...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="flex-grow flex items-center justify-center pt-32">
          <div className="bg-gray-900 rounded-lg p-8 text-center border border-gray-800">
            <span className="material-symbols-outlined text-6xl text-red-400 mb-4">
              error
            </span>
            <p className="text-red-400">Error: {error}</p>
          </div>
        </div>
      )}

      {status !== "loading" && !error && details && (
        <>
          {/* Top Space for Additional Fields */}
          <div className="w-full bg-black pt-20">
            <div className="max-w-full mx-auto px-10 py-6">
              <div
                className="flex items-center justify-between"
                style={{ minHeight: "150px" }}
              >
                {/* Reserved space for future fields */}
                <div className="flex-1">
                  {/* Additional fields will go here */}
                </div>
                {/* List Title - Top Right */}
                <div className="text-right">
                  <h1 className="text-4xl font-bold text-white">
                    {details.name}
                  </h1>
                  {details.description && (
                    <p className="text-gray-400 mt-2">{details.description}</p>
                  )}
                  <p className="text-gray-500 text-sm mt-1">
                    {items?.length || 0} items
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Control Header */}
          <div className="w-full bg-black/95 backdrop-blur-sm border-b border-gray-900 sticky top-16 z-40">
            <div className="max-w-full mx-auto px-10 py-3">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                {/* Left: Search */}
                <div className="flex-1 w-full lg:w-auto">
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
                      search
                    </span>
                    <input
                      type="text"
                      placeholder="Filter this list..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full lg:w-96 pl-10 pr-4 py-2 bg-transparent rounded-full text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-white/20 border border-gray-800"
                    />
                  </div>
                </div>

                {/* Right: Filters and Actions */}
                <div className="flex flex-wrap items-center gap-3">
                  {/* Filter Chips */}
                  <button
                    onClick={() => setFilterType("all")}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      filterType === "all"
                        ? "bg-white text-black"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setFilterType("movie")}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      filterType === "movie"
                        ? "bg-white text-black"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    Movies
                  </button>
                  <button
                    onClick={() => setFilterType("tv")}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                      filterType === "tv"
                        ? "bg-white text-black"
                        : "bg-gray-800 text-gray-400 hover:bg-gray-700"
                    }`}
                  >
                    TV Shows
                  </button>

                  {/* Sort Dropdown */}
                  <select
                    value={sortType}
                    onChange={(e) => setSortType(e.target.value)}
                    className="px-4 py-2 bg-gray-900 border border-gray-900 rounded-full text-white text-sm focus:outline-none focus:ring-2 focus:ring-white/20 cursor-pointer"
                  >
                    <option value="dateAddedDesc">Sort: Date Added</option>
                    <option value="titleAsc">Sort: Title (A-Z)</option>
                    <option value="voteAverageDesc">Sort: Rating</option>
                  </select>

                  {/* Export Button */}
                  <button
                    onClick={handleExport}
                    disabled={exporting}
                    className={`px-4 py-2 bg-gray-900 border border-gray-900 rounded-full text-sm flex items-center gap-2 transition-all ${
                      exporting
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-gray-800"
                    }`}
                  >
                    <span className="material-symbols-outlined text-lg">
                      download
                    </span>
                    <span className="text-white">Export</span>
                  </button>

                  {/* Enrich Button */}
                  <button
                    onClick={handleEnrichList}
                    disabled={isEnriching || !items || items.length === 0}
                    className={`px-4 py-2 bg-blue-600 border border-blue-600 rounded-full text-sm flex items-center gap-2 transition-all ${
                      isEnriching || !items || items.length === 0
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-blue-700"
                    }`}
                    title="Fetch ratings and metadata for all items"
                  >
                    <span className={`material-symbols-outlined text-lg ${isEnriching ? 'animate-spin' : ''}`}>
                      {isEnriching ? "sync" : "cloud_sync"}
                    </span>
                    <span className="text-white">
                      {isEnriching ? "Enriching..." : "Enrich Data"}
                    </span>
                  </button>
                </div>
              </div>

              {/* Enrichment Progress Bar */}
              {isEnriching && (
                <div className="mt-4 p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-blue-400 text-sm font-medium">
                      Enriching items... {enrichProgress.current} / {enrichProgress.total}
                    </span>
                    <span className="text-blue-400 text-sm">
                      {Math.round((enrichProgress.current / enrichProgress.total) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-blue-500 h-full transition-all duration-300 ease-out"
                      style={{
                        width: `${(enrichProgress.current / enrichProgress.total) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              )}

              {successMessage && (
                <div className="mt-3 p-2.5 bg-green-900/30 border border-green-700 rounded-lg text-green-400 text-center text-sm">
                  {successMessage}
                </div>
              )}
            </div>
          </div>

          {/* Main Content Grid */}
          <main className="flex-grow w-full bg-black pb-20">
            <div className="max-w-full mx-auto px-10 py-8">
              {filteredAndSortedItems.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-2">
                  {filteredAndSortedItems.map((item, index) => {
                    // Merge live enrichment data with item data
                    const enrichedData = enrichedItems.get(item.id);
                    const displayItem = enrichedData 
                      ? { ...item, ...enrichedData }
                      : item;
                    
                    return (
                      <MovieCard
                        key={`${item.id}-${index}`}
                        movie={displayItem}
                        onRemove={() => handleRemoveItem(item)}
                        vaultMode={true}
                      />
                    );
                  })}
                </div>
              ) : (
                <div className="bg-gray-900 rounded-lg p-16 text-center border border-gray-800 mt-20">
                  <span className="material-symbols-outlined text-7xl text-gray-700 mb-4">
                    {searchQuery || filterType !== "all"
                      ? "search_off"
                      : "movie_off"}
                  </span>
                  <p className="text-gray-400 text-lg">
                    {searchQuery || filterType !== "all"
                      ? "No items match your filters"
                      : "This collection is empty. Go browse to add items."}
                  </p>
                </div>
              )}
            </div>
          </main>
        </>
      )}
    </div>
  );
};

export default ListDetailsPage;
