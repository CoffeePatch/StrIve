import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useLists } from '../../domain/lists/useLists';
import Header from '../layout/Header';
import PosterCollage from '../lists/PosterCollage';
import CreateListModal from '../lists/CreateListModal';
import EditListModal from '../lists/EditListModal';
import { AnimatedButton } from '../ui/AnimatedPrimitives';
import { Plus, Pin, Trash2, Edit3, Search, ListFilter, ArrowRight } from 'lucide-react';

export default function ListsHubPage() {
  const navigate = useNavigate();
  const user = useSelector((store) => store.user.user);
  const userId = user?.uid;

  const {
    lists = [],
    listsStatus,
    loadLists,
    removeList,
    updateList,
    pinList,
    unpinList
  } = useLists(userId);

  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingList, setEditingList] = useState(null);
  const [deletingListId, setDeletingListId] = useState(null);

  useEffect(() => {
    if (userId) {
      loadLists();
    }
  }, [userId, loadLists]);

  const filteredLists = useMemo(() => {
    if (!searchQuery.trim()) return lists;
    const q = searchQuery.toLowerCase();
    return lists.filter(
      (l) => l.name.toLowerCase().includes(q) || (l.description && l.description.toLowerCase().includes(q))
    );
  }, [lists, searchQuery]);

  const handleTogglePin = async (e, list) => {
    e.stopPropagation();
    if (list.isPinned) {
      await unpinList(list.id);
    } else {
      await pinList(list.id);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingListId) return;
    try {
      await removeList(deletingListId);
      setDeletingListId(null);
    } catch (err) {
      console.error('Failed to delete list:', err);
    }
  };

  const handleEditSave = async (listId, updates) => {
    await updateList(listId, updates);
  };

  const isLoading = listsStatus === 'loading' && lists.length === 0;

  return (
    <div className="min-h-screen bg-backdrop text-primary font-main pb-24">
      <Header />

      <main className="pt-24 px-4 sm:px-8 lg:px-12 max-w-7xl mx-auto space-y-8 animate-fade-in">
        {/* Page Title & Top Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black font-secondary tracking-tight">Custom Lists</h1>
              <span className="px-2.5 py-1 rounded-full bg-surface-hover border border-border-subtle text-xs font-semibold text-secondary font-secondary">
                {lists.length} {lists.length === 1 ? 'Collection' : 'Collections'}
              </span>
            </div>
            <p className="text-sm text-secondary font-secondary mt-1">
              Curate, organize, and reorder custom media collections
            </p>
          </div>

          <div className="flex items-center gap-3">
            <AnimatedButton
              onClick={() => setIsCreateOpen(true)}
              className="px-4 py-2.5 rounded-xl bg-accent text-white font-secondary text-sm font-semibold flex items-center gap-2 hover:bg-accent-hover transition-all shadow-lg shadow-accent/20"
            >
              <Plus className="w-4 h-4" />
              <span>Create New List</span>
            </AnimatedButton>
          </div>
        </div>

        {/* Search & Filter Bar */}
        {lists.length > 0 && (
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search lists..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface border border-border-subtle rounded-xl pl-10 pr-4 py-2 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-accent/60 font-secondary"
              />
            </div>
          </div>
        )}

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="glass-effect rounded-2xl p-5 border border-border-subtle bg-surface space-y-4 animate-pulse">
                <div className="w-full aspect-[16/9] sm:aspect-[3/2] bg-surface-hover rounded-xl" />
                <div className="h-5 bg-surface-hover rounded w-2/3" />
                <div className="h-4 bg-surface-hover rounded w-1/3" />
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredLists.length === 0 && (
          <div className="glass-effect rounded-3xl p-12 border border-border-subtle bg-surface text-center space-y-4 max-w-md mx-auto my-12">
            <div className="w-16 h-16 rounded-full bg-surface-hover flex items-center justify-center mx-auto text-accent">
              <ListFilter className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold font-secondary text-primary">
                {searchQuery ? 'No matching lists found' : 'No Custom Lists Yet'}
              </h3>
              <p className="text-xs text-secondary font-secondary">
                {searchQuery
                  ? `No lists matched "${searchQuery}". Try a different keyword.`
                  : 'Create custom lists to group movies & TV shows for movie nights, rewatches, or specific themes.'}
              </p>
            </div>
            {!searchQuery && (
              <AnimatedButton
                onClick={() => setIsCreateOpen(true)}
                className="mt-4 px-6 py-2.5 rounded-xl bg-accent text-white font-secondary text-sm font-semibold inline-flex items-center gap-2 hover:bg-accent-hover transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Create Your First List</span>
              </AnimatedButton>
            )}
          </div>
        )}

        {/* Custom Lists Visual Grid */}
        {!isLoading && filteredLists.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredLists.map((list) => (
              <div
                key={list.id}
                onClick={() => navigate(`/library?list=${list.id}`)}
                className="glass-effect rounded-2xl border border-border-subtle bg-surface hover:border-accent/40 transition-all duration-300 group cursor-pointer overflow-hidden flex flex-col justify-between"
              >
                <div className="p-5 space-y-4">
                  {/* Poster Collage Preview */}
                  <div className="relative">
                    <PosterCollage items={list.items || []} />
                    <button
                      onClick={(e) => handleTogglePin(e, list)}
                      title={list.isPinned ? 'Unpin list' : 'Pin list'}
                      className={`absolute top-2.5 right-2.5 p-2 rounded-full backdrop-blur-md border transition-all ${
                        list.isPinned
                          ? 'bg-accent/90 border-accent text-white shadow-lg'
                          : 'bg-black/60 border-white/10 text-white/70 opacity-0 group-hover:opacity-100 hover:text-white'
                      }`}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* List Info */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-base font-bold font-secondary text-primary group-hover:text-accent transition-colors line-clamp-1">
                        {list.name}
                      </h2>
                      <span className="text-[11px] font-semibold text-secondary font-secondary px-2 py-0.5 rounded-full bg-surface-hover border border-border-subtle shrink-0">
                        {list.itemCount || 0} {list.itemCount === 1 ? 'item' : 'items'}
                      </span>
                    </div>

                    {list.description && (
                      <p className="text-xs text-secondary font-secondary line-clamp-2 leading-relaxed">
                        {list.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="px-5 py-3 border-t border-border-subtle bg-surface-hover/40 flex items-center justify-between text-xs text-secondary font-secondary">
                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingList(list);
                      }}
                      className="p-1.5 rounded-lg hover:bg-surface-hover hover:text-primary transition-colors flex items-center gap-1"
                      title="Edit List Metadata"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingListId(list.id);
                      }}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-colors flex items-center gap-1 text-muted"
                      title="Delete List"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1 text-accent font-medium group-hover:translate-x-1 transition-transform ml-auto">
                    <span>View List</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create List Modal */}
      <CreateListModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        userId={userId}
      />

      {/* Edit List Modal */}
      <EditListModal
        list={editingList}
        isOpen={Boolean(editingList)}
        onClose={() => setEditingList(null)}
        onSave={handleEditSave}
      />

      {/* Delete Confirmation Modal */}
      {deletingListId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in font-secondary">
          <div className="w-full max-w-sm bg-surface border border-border-subtle rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-primary">Delete Custom List?</h3>
            <p className="text-xs text-secondary leading-relaxed">
              Are you sure you want to delete this custom list? The media items inside your library will remain untouched.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => setDeletingListId(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-secondary hover:text-primary transition-colors"
              >
                Cancel
              </button>
              <AnimatedButton
                onClick={handleDeleteConfirm}
                className="px-4 py-2 rounded-xl bg-red-600 text-white font-medium text-xs hover:bg-red-700 transition-colors"
              >
                Delete List
              </AnimatedButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
