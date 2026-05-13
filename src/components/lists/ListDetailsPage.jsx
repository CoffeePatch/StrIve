import React, { useEffect, useCallback, useMemo, useRef, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import useRequireAuth from "../../hooks/common/useRequireAuth";
import {
  fetchActiveList,
  removeItem,
  addItem,
  deleteList,
  updateListMetadata,
} from "../../util/store/listsSlice";
import MovieCard from "../movie/Cards/MovieCard";
import Header from "../layout/Header";
import { exportListCsv } from "../../util/export/exportDownload";
import manualEnrichmentService from "../../services/enrichment/manualEnrichmentService";
import { toast } from "react-toastify";
import {
  getLibraryItemListIds,
  removeListIdFromAllLibraryItems,
  setLibraryItemListIds,
  toggleCustomListTag,
} from "../../util/firebase/firestoreService";

const ListDetailsPage = () => {
  const dispatch = useDispatch();
  const user = useRequireAuth();
  const userId = user?.uid;
  const { listId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { details, items, status, error } = useSelector(
    (state) => state.lists.activeList
  );
  const [successMessage, setSuccessMessage] = useState(null);
  const [filterType, setFilterType] = useState("all");
  const [sortType, setSortType] = useState("dateAddedDesc");
  const [searchQuery, setSearchQuery] = useState("");

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Enrichment state
  const [isEnriching, setIsEnriching] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState({ current: 0, total: 0 });
  const [enrichedItems, setEnrichedItems] = useState(new Map());

  useEffect(() => {
    if (userId && listId) {
      dispatch(fetchActiveList({ userId, listId }));
    }
  }, [dispatch, userId, listId]);

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

  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (e) => {
      const node = menuRef.current;
      if (!node) return;
      if (node.contains(e.target)) return;
      setMenuOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [menuOpen]);

  const handleRemoveItem = async (item) => {
    if (!userId || !listId) return;

    let prevListIds = [];
    try {
      prevListIds = await getLibraryItemListIds(userId, item);
    } catch (e) {
      console.debug("Failed to fetch listIds before remove:", e?.message || e);
    }

    const nextListIds = (prevListIds || []).filter((id) => id !== listId);

    try {
      await dispatch(removeItem({ userId, listId, mediaId: item.id })).unwrap();
      await setLibraryItemListIds(userId, item, nextListIds);
    } catch (err) {
      console.error("Failed to remove item:", err);
      toast.error("Failed to remove item");
      return;
    }

    toast(
      ({ closeToast }) => (
        <div className="flex items-center gap-3">
          <span className="text-sm">Removed from list</span>
          <button
            className="text-sm underline"
            onClick={async () => {
              try {
                await dispatch(addItem({ userId, listId, mediaItem: item })).unwrap();

                const currentListIds = await getLibraryItemListIds(userId, item);
                const restored = Array.isArray(currentListIds)
                  ? (currentListIds.includes(listId) ? currentListIds : [...currentListIds, listId])
                  : [listId];
                await setLibraryItemListIds(userId, item, restored);

                closeToast?.();
              } catch (undoErr) {
                console.error("Undo failed:", undoErr);
                toast.error("Undo failed");
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
  };

  const [exporting, setExporting] = useState(false);
  const handleExport = useCallback(async () => {
    if (!userId || !listId) return;
    try {
      setExporting(true);
      await exportListCsv(listId, details?.name);
    } finally {
      setExporting(false);
    }
  }, [userId, listId, details]);

  const openEdit = useCallback(() => {
    setMenuOpen(false);
    setEditTitle(details?.name || "");
    setEditDescription(details?.description || "");
    setEditOpen(true);
  }, [details]);

  const saveEdit = useCallback(async () => {
    if (!userId || !listId) return;

    const nextName = String(editTitle || "").trim();
    const nextDescription = String(editDescription || "").trim();

    if (!nextName) {
      toast.error("Title is required");
      return;
    }

    try {
      setSavingEdit(true);
      await dispatch(
        updateListMetadata({
          userId,
          listId,
          updates: { name: nextName, description: nextDescription },
        })
      ).unwrap();
      setEditOpen(false);
      toast.success("List updated");
    } catch (e) {
      console.error("Update list failed:", e);
      toast.error("Failed to update list");
    } finally {
      setSavingEdit(false);
    }
  }, [userId, listId, editTitle, editDescription, dispatch]);

  const openDelete = useCallback(() => {
    setMenuOpen(false);
    setDeleteOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!userId || !listId) return;

    try {
      setDeleting(true);
      await dispatch(deleteList({ userId, listId })).unwrap();
      setDeleteOpen(false);

      toast.success("List deleted");

      // Clean up tags from library items (client-side for free tier)
      removeListIdFromAllLibraryItems(userId, listId)
        .then((count) => {
          if (count > 0) {
            toast.info(`Cleaned up ${count} item(s)`);
          }
        })
        .catch((err) => {
          console.debug("Tag cleanup skipped:", err?.message || err);
        });

      navigate("/library", { replace: true });
    } catch (e) {
      console.error("Delete list failed:", e);
      toast.error("Failed to delete list");
    } finally {
      setDeleting(false);
    }
  }, [userId, listId, dispatch, navigate]);

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
                <div className="flex items-start justify-end gap-3" ref={menuRef}>
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

                  <div className="relative">
                    <button
                      type="button"
                      className="p-2 rounded-full border border-gray-800 bg-transparent hover:bg-gray-900 transition-all"
                      onClick={() => setMenuOpen((v) => !v)}
                      aria-label="List menu"
                      aria-expanded={menuOpen}
                    >
                      <span className="material-symbols-outlined text-white">more_vert</span>
                    </button>

                    {menuOpen && (
                      <div className="absolute right-0 mt-2 w-44 bg-gray-900 border border-gray-800 rounded-lg overflow-hidden z-50">
                        <button
                          type="button"
                          onClick={openEdit}
                          className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-800"
                        >
                          Edit List
                        </button>
                        <button
                          type="button"
                          onClick={openDelete}
                          className="w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-800"
                        >
                          Delete List
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            setMenuOpen(false);
                            await handleExport();
                          }}
                          disabled={exporting}
                          className={`w-full text-left px-4 py-2 text-sm text-white hover:bg-gray-800 ${
                            exporting ? "opacity-50 cursor-not-allowed" : ""
                          }`}
                        >
                          Export List
                        </button>
                      </div>
                    )}
                  </div>
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

          {/* Edit Modal */}
          {editOpen && (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
              <div className="bg-gray-900 rounded-xl w-full max-w-xl">
                <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">Edit List</h2>
                  <button
                    onClick={() => setEditOpen(false)}
                    className="text-gray-400 hover:text-white"
                    aria-label="Close"
                    disabled={savingEdit}
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div className="p-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Title</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-600"
                      placeholder="List title"
                      disabled={savingEdit}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-600 min-h-[110px]"
                      placeholder="Optional description"
                      disabled={savingEdit}
                    />
                  </div>
                </div>

                <div className="p-4 border-t border-gray-800 flex justify-end gap-3">
                  <button
                    className="px-4 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-700"
                    onClick={() => setEditOpen(false)}
                    disabled={savingEdit}
                  >
                    Cancel
                  </button>
                  <button
                    className={`px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 ${
                      savingEdit ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                    onClick={saveEdit}
                    disabled={savingEdit}
                  >
                    {savingEdit ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Modal */}
          {deleteOpen && (
            <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
              <div className="bg-gray-900 rounded-xl w-full max-w-xl">
                <div className="p-4 border-b border-gray-800 flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-white">Delete List</h2>
                  <button
                    onClick={() => setDeleteOpen(false)}
                    className="text-gray-400 hover:text-white"
                    aria-label="Close"
                    disabled={deleting}
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                <div className="p-4">
                  <p className="text-white">
                    Are you sure? This cannot be undone.
                  </p>
                  <p className="text-gray-400 mt-2">
                    This will permanently delete <span className="text-white font-semibold">{details?.name}</span>.
                  </p>
                </div>

                <div className="p-4 border-t border-gray-800 flex justify-end gap-3">
                  <button
                    className="px-4 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-700"
                    onClick={() => setDeleteOpen(false)}
                    disabled={deleting}
                  >
                    Cancel
                  </button>
                  <button
                    className={`px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 ${
                      deleting ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                    onClick={confirmDelete}
                    disabled={deleting}
                  >
                    {deleting ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ListDetailsPage;
