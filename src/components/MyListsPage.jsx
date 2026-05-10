import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchLists, deleteList, pinListThunk, unpinListThunk, createDefaultList } from "../util/listsSlice";
import useRequireAuth from "../hooks/useRequireAuth";
import ShelfCard from "./ShelfCard";
import BookshelfListCard from "./BookshelfListCard";
import Header from "./Header";
import CreateListModal from "./CreateListModal";
import ConfirmationModal from "./ConfirmationModal";
import { exportListCsv } from "../util/exportDownload";

const MyListsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useRequireAuth();
  const { customLists } = useSelector((state) => state.lists);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [listToDelete, setListToDelete] = useState(null);
  const [exportingListId, setExportingListId] = useState(null);
  const [viewMode, setViewMode] = useState("grid");
  const [hasCheckedDefaultList, setHasCheckedDefaultList] = useState(false);
  const [bulkDeleteMode, setBulkDeleteMode] = useState(false);
  const [selectedLists, setSelectedLists] = useState([]);

  useEffect(() => {
    if (user) {
      dispatch(fetchLists(user.uid));
    }
  }, [dispatch, user]);
  
  // Create default "Watch Later" list on first login
  useEffect(() => {
    if (user && customLists.status === 'succeeded' && !hasCheckedDefaultList) {
      setHasCheckedDefaultList(true);
      if (!customLists.lists || customLists.lists.length === 0) {
        dispatch(createDefaultList(user.uid));
      }
    }
  }, [user, customLists.status, customLists.lists, hasCheckedDefaultList, dispatch]);

  const handleExportList = async (listId, listName) => {
    setExportingListId(listId);
    try {
      await exportListCsv(listId, listName);
    } finally {
      setExportingListId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (user && listToDelete) {
      try {
        await dispatch(
          deleteList({
            userId: user.uid,
            listId: listToDelete.id,
          })
        ).unwrap();
        setListToDelete(null);
      } catch (err) {
        console.error("Failed to delete list:", err);
      }
    }
  };
  
  const handleTogglePin = async (listId, currentlyPinned) => {
    if (!user) return;
    try {
      if (currentlyPinned) {
        await dispatch(unpinListThunk({ userId: user.uid, listId })).unwrap();
      } else {
        await dispatch(pinListThunk({ userId: user.uid, listId })).unwrap();
      }
    } catch (err) {
      alert(err || "Failed to update pin status");
    }
  };

  const handleToggleSelect = (listId) => {
    setSelectedLists(prev => 
      prev.includes(listId) ? prev.filter(id => id !== listId) : [...prev, listId]
    );
  };

  const handleBulkDelete = async () => {
    if (!user || selectedLists.length === 0) return;
    if (!confirm(`Delete ${selectedLists.length} lists?`)) return;
    
    try {
      for (const listId of selectedLists) {
        await dispatch(deleteList({ userId: user.uid, listId })).unwrap();
      }
      setSelectedLists([]);
      setBulkDeleteMode(false);
      alert(`Deleted ${selectedLists.length} lists!`);
    } catch (err) {
      alert("Failed to delete some lists");
    }
  };

  const loading = customLists.status === "loading";
  const error = customLists.error;

  return (
    <div className="min-h-screen premium-page flex flex-col">
      <Header />

      {/* Hero Section */}
      <div className="pt-24 pb-12 px-10">
        <div className="max-w-full mx-auto">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="glass-effect p-4 rounded-full">
                  <span className="material-symbols-outlined text-5xl gradient-accent">
                    collections_bookmark
                  </span>
                </div>
                <h1 className="font-display text-5xl lg:text-6xl font-bold gradient-text">
                  My Collections
                </h1>
              </div>
              <p className="text-white/60 font-secondary text-lg">
                Manage your watchlists and custom collections
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              {/* Bulk Delete Button */}
              {!bulkDeleteMode && (
                <button
                  onClick={() => setBulkDeleteMode(true)}
                  className="btn-secondary flex items-center gap-2 bg-red-600/20 hover:bg-red-600/30 text-red-400"
                >
                  <span className="material-symbols-outlined">delete_sweep</span>
                  <span>Bulk Delete</span>
                </button>
              )}
              
              {bulkDeleteMode && (
                <>
                  <button
                    onClick={() => {
                      if (selectedLists.length === customLists.lists.length) {
                        setSelectedLists([]);
                      } else {
                        setSelectedLists(customLists.lists.map(l => l.id));
                      }
                    }}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined">
                      {selectedLists.length === customLists.lists.length ? 'deselect' : 'select_all'}
                    </span>
                    <span>{selectedLists.length === customLists.lists.length ? 'Unselect All' : 'Select All'}</span>
                  </button>
                  <button
                    onClick={handleBulkDelete}
                    disabled={selectedLists.length === 0}
                    className="btn-primary flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50"
                  >
                    <span className="material-symbols-outlined">delete</span>
                    <span>Delete ({selectedLists.length})</span>
                  </button>
                  <button
                    onClick={() => { setBulkDeleteMode(false); setSelectedLists([]); }}
                    className="btn-secondary flex items-center gap-2"
                  >
                    <span>Cancel</span>
                  </button>
                </>
              )}
              
              {/* View Mode Toggle */}
              <div className="glass-effect rounded-xl p-1 flex gap-1">
                <button
                  onClick={() => setViewMode("bookshelf")}
                  className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                    viewMode === "bookshelf"
                      ? "bg-red-600 text-white"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                  aria-label="Bookshelf view"
                >
                  <span className="material-symbols-outlined text-xl">
                    view_agenda
                  </span>
                  <span className="font-secondary text-sm hidden sm:inline">
                    Wide
                  </span>
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={`px-4 py-2 rounded-lg transition-all flex items-center gap-2 ${
                    viewMode === "grid"
                      ? "bg-red-600 text-white"
                      : "text-white/60 hover:text-white hover:bg-white/10"
                  }`}
                  aria-label="Grid view"
                >
                  <span className="material-symbols-outlined text-xl">
                    grid_view
                  </span>
                  <span className="font-secondary text-sm hidden sm:inline">
                    Grid
                  </span>
                </button>
              </div>

              <button
                onClick={() => navigate("/import")}
                className="btn-secondary flex items-center gap-2"
              >
                <span className="material-symbols-outlined">upload</span>
                <span>Import CSV</span>
              </button>
              <button
                onClick={() => setIsModalOpen(true)}
                className="btn-primary flex items-center gap-2"
              >
                <span className="material-symbols-outlined">add</span>
                <span>Create New List</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-grow w-full px-10 pb-20">
        <div className="max-w-full mx-auto">
          {loading && (
            <div className="text-center py-20">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-white/20 border-t-red-600 mx-auto mb-4"></div>
              <p className="text-white/60 font-secondary">
                Loading your lists...
              </p>
            </div>
          )}

          {error && (
            <div className="glass-effect rounded-2xl p-8 text-center">
              <span className="material-symbols-outlined text-6xl text-red-400 mb-4">
                error
              </span>
              <p className="text-red-400 font-secondary">Error: {error}</p>
            </div>
          )}

          {!loading && !error && (
            <div>
              {/* My Collections Header */}
              <h2 className="text-3xl font-bold font-display text-white mb-6 flex items-center gap-3">
                <span className="material-symbols-outlined text-4xl text-red-600">
                  {viewMode === "bookshelf"
                    ? "shelves"
                    : "collections_bookmark"}
                </span>
                {viewMode === "bookshelf"
                  ? "Library Shelves"
                  : "Collection Grid"}
              </h2>

              {/* Unified Grid/List: All Custom Lists (sorted by pin status) */}
              {customLists.lists.length > 0 ? (
                <div
                  className={
                    viewMode === "grid"
                      ? "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-x-4 gap-y-8 pb-8"
                      : "flex flex-col gap-6"
                  }
                >
                  {/* All Lists (pinned appear first due to sorting in Redux) */}
                  {customLists.lists.map((list) =>
                    viewMode === "grid" ? (
                      <div 
                        key={list.id} 
                        className={`relative transition-all ${selectedLists.includes(list.id) ? 'ring-4 ring-red-500 rounded-lg' : ''}`}
                      >
                        <ShelfCard
                          list={list}
                          onDelete={setListToDelete}
                          onExport={handleExportList}
                          onTogglePin={handleTogglePin}
                          isExporting={exportingListId === list.id}
                          bulkDeleteMode={bulkDeleteMode}
                          onSelect={() => handleToggleSelect(list.id)}
                        />
                      </div>
                    ) : (
                      <div 
                        key={list.id} 
                        className={`relative transition-all ${selectedLists.includes(list.id) ? 'ring-4 ring-red-500 rounded-lg' : ''}`}
                      >
                        <BookshelfListCard
                          list={list}
                          onDelete={setListToDelete}
                          onExport={handleExportList}
                          onTogglePin={handleTogglePin}
                          isExporting={exportingListId === list.id}
                          bulkDeleteMode={bulkDeleteMode}
                          onSelect={() => handleToggleSelect(list.id)}
                        />
                      </div>
                    )
                  )}
                </div>
              ) : (
                <div className="glass-effect rounded-2xl p-12 text-center">
                  <span className="material-symbols-outlined text-7xl text-white/20 mb-4">
                    collections_bookmark
                  </span>
                  <p className="text-white/60 font-secondary mb-4">
                    Your library is empty. Start creating collections!
                  </p>
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="btn-primary"
                  >
                    <span className="material-symbols-outlined">add</span>
                    <span>Create Your First Collection</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <ConfirmationModal
        isOpen={!!listToDelete}
        onClose={() => setListToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete List"
        message={`Are you sure you want to permanently delete the list '${listToDelete?.name}'?`}
      />

      <CreateListModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        userId={user?.uid}
      />
    </div>
  );
};

export default MyListsPage;
