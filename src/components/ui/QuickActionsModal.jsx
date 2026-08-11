import React, { useState, useEffect } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { useMotionPreferences } from '../../hooks/useMotionPreferences';
import { libraryAdapter } from '../../domain/library/libraryAdapter';
import { useLists } from '../../domain/lists/useLists';
import { useListMembership } from '../../domain/lists/useListMembership';
import { invalidateBrowseLibrary } from '../../util/cache/sessionCache';
import { normalizeWatchStatus, toDisplayWatchStatus } from '../../util/library/watchStatus';
import { AnimatedCheckbox } from './AnimatedPrimitives';
import { toast } from 'react-toastify';

const STATUS_OPTIONS = [
  { key: 'plan_to_watch', label: 'Plan to Watch', icon: 'bookmark' },
  { key: 'watching', label: 'Watching', icon: 'play_circle' },
  { key: 'completed', label: 'Completed', icon: 'check_circle' },
  { key: 'on_hold', label: 'On Hold', icon: 'pause_circle' },
  { key: 'dropped', label: 'Dropped', icon: 'cancel' }
];

const QuickActionsModal = ({ isOpen, onClose, media, userId, onMutation, anchor }) => {
  const { shouldReduceMotion } = useMotionPreferences();
  const [currentStatus, setCurrentStatus] = useState(null);
  const [isListsExpanded, setIsListsExpanded] = useState(false);
  const [hoveringLists, setHoveringLists] = useState(false);
  const [isLoadingMembership, setIsLoadingMembership] = useState(false);
  const [hasLoadedMembership, setHasLoadedMembership] = useState(false);
  const [savedListIds, setSavedListIds] = useState([]);
  const [selectedListIds, setSelectedListIds] = useState([]);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  const { lists: customLists = [], loadLists, listsStatus } = useLists(userId);
  const { addMediaToList, removeMediaFromList } = useListMembership(userId);

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 640;

  // Initialize and load data on open
  useEffect(() => {
    if (isOpen && media) {
      const status = media.tracking?.watchStatus ?? media.watchStatus ?? media.status ?? null;
      setCurrentStatus(normalizeWatchStatus(status));
      setShowConfirmDelete(false);
      setIsListsExpanded(false);
      setHasLoadedMembership(false);
      setSavedListIds([]);
      setSelectedListIds([]);
    }
  }, [isOpen, media]);

  // Load custom lists if not loaded
  useEffect(() => {
    if (isOpen && userId && listsStatus === 'idle') {
      loadLists();
    }
  }, [isOpen, userId, listsStatus, loadLists]);

  // Fetch list memberships asynchronously ON DEMAND when accordion expands (mobile) or hovering starts (desktop)
  useEffect(() => {
    const shouldFetch = isListsExpanded || (!isMobile && hoveringLists);
    if (!isOpen || !userId || !media || !shouldFetch || hasLoadedMembership) return;

    let active = true;
    const fetchMembership = async () => {
      try {
        setIsLoadingMembership(true);
        const { listsAdapter } = await import('../../domain/lists/listsAdapter');
        const listIds = await listsAdapter.getItemListMemberships(userId, media);
        if (!active) return;
        const normalized = Array.isArray(listIds) ? listIds.filter(Boolean) : [];
        setSavedListIds(normalized);
        setSelectedListIds(normalized);
        setHasLoadedMembership(true);
      } catch (err) {
        console.error('Failed to load memberships in modal:', err);
      } finally {
        if (active) {
          setIsLoadingMembership(false);
        }
      }
    };

    fetchMembership();
    return () => {
      active = false;
    };
  }, [isOpen, userId, media, isListsExpanded, hoveringLists, hasLoadedMembership, isMobile]);

  if (!isOpen || !media) return null;

  const modalStyle = !isMobile && anchor ? {
    position: 'fixed',
    top: Math.min(anchor.y + 8, window.innerHeight - 450),
    left: anchor.right > 350 ? anchor.x : 'auto',
    right: anchor.right <= 350 ? anchor.right : 'auto',
    margin: 0
  } : {};

  const title = media.title || media.name || media.originalTitle || media.originalName || 'Unknown Title';
  const rawDate = media.releaseDate || media.firstAirDate || media.release_date || media.first_air_date;
  const year = media.releaseYear && media.releaseYear !== "N/A" ? media.releaseYear : (rawDate ? new Date(rawDate).getFullYear() : null);
  const type = media.mediaType || media.media_type || (media.firstAirDate || media.first_air_date || media.name ? 'tv' : 'movie');

  const handleStatusChange = async (newStatus) => {
    if (!userId || isMutating) return;
    const prevStatus = currentStatus;
    // Toggling already selected status -> sets to null / removes status
    const targetStatus = prevStatus === newStatus ? null : newStatus;
    
    setIsMutating(true);
    setCurrentStatus(targetStatus);

    try {
      await libraryAdapter.updateLibraryStatus(userId, media, targetStatus);
      invalidateBrowseLibrary(userId);
      toast.success(targetStatus ? `Status updated to ${toDisplayWatchStatus(targetStatus)}` : 'Removed watch status');
      if (onMutation) onMutation();
    } catch (err) {
      console.error('Failed to update status:', err);
      setCurrentStatus(prevStatus); // Revert
      toast.error('Failed to update status');
    } finally {
      setIsMutating(false);
    }
  };

  const handleToggleList = async (listId) => {
    if (!userId || isMutating) return;
    const isAdding = !selectedListIds.includes(listId);

    setIsMutating(true);
    // Optimistic UI update
    setSelectedListIds(prev =>
      isAdding ? [...prev, listId] : prev.filter(id => id !== listId)
    );

    try {
      const nextListIds = isAdding
        ? [...selectedListIds, listId]
        : selectedListIds.filter(id => id !== listId);

        const { listsAdapter } = await import('../../domain/lists/listsAdapter');
        await listsAdapter.setItemListMemberships(userId, media, nextListIds);

      if (isAdding) {
        await addMediaToList(listId, media);
        toast.success(`Added to ${customLists.find(l => l.id === listId)?.name || 'list'}`);
      } else {
        await removeMediaFromList(listId, media.id);
        toast.success(`Removed from ${customLists.find(l => l.id === listId)?.name || 'list'}`);
      }

      setSavedListIds(nextListIds);
      if (onMutation) onMutation();
    } catch (err) {
      console.error('Failed to toggle list membership:', err);
      // Revert optimistic UI
      setSelectedListIds(savedListIds);
      toast.error('Failed to update list membership');
    } finally {
      setIsMutating(false);
    }
  };

  const handleRemoveFromLibrary = async () => {
    if (!userId || isMutating) return;
    setIsMutating(true);
    setIsRemoving(true);

    try {
      // Deletes library item document and inline listIds in Firestore in a single write
      await libraryAdapter.removeLibraryItem(userId, media);
      invalidateBrowseLibrary(userId);

      // Clean up lists in Redux
      if (Array.isArray(savedListIds) && savedListIds.length > 0) {
        await Promise.all(
          savedListIds.map(listId => removeMediaFromList(listId, media.id))
        );
      }

      toast.success('Removed item from Library');
      if (onMutation) onMutation();
      onClose();
    } catch (err) {
      console.error('Failed to remove from library:', err);
      toast.error('Failed to remove from library');
    } finally {
      setIsRemoving(false);
      setIsMutating(false);
      setShowConfirmDelete(false);
    }
  };

  const RESERVED_STATUS_IDS = new Set(['Plan to Watch', 'Completed', 'Watching', 'Dropped']);
  const availableLists = customLists.filter(
    (list) => list && !RESERVED_STATUS_IDS.has(list.name)
  );

  // Sort lists: pinned first, then by creation date
  const sortedLists = [...availableLists].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    if (a.isPinned && b.isPinned) {
      return new Date(b.pinnedAt) - new Date(a.pinnedAt);
    }
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const isInLibrary = currentStatus !== null || savedListIds.length > 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-backdrop sm:bg-transparent backdrop-blur-sm sm:backdrop-blur-none"
          />

          {/* Modal Container */}
          <motion.div
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 50, scale: 0.95 }}
            animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 50, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.4, 0.0, 0.2, 1] }}
            style={modalStyle}
            className="glass-effect rounded-t-3xl sm:rounded-xl px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:p-3 max-w-full sm:max-w-[220px] w-full border-t sm:border border-border-subtle bg-surface/98 shadow-2xl relative z-10 flex flex-col max-h-[85vh] sm:max-h-[90vh] overflow-hidden sm:overflow-visible"
          >
            {/* Gesture handle bar for mobile */}
            <div className="w-full flex justify-center sm:hidden pb-4">
              <div className="w-12 h-1.5 bg-border rounded-full" />
            </div>

            {/* Close button */}
            <button
              onClick={onClose}
              disabled={isMutating}
              className="absolute top-3 right-3 text-secondary hover:text-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed hidden sm:block"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>

            {/* Header */}
            <div className="pr-6 mb-3">
              <h3 className="text-sm font-bold text-primary font-secondary truncate" title={title}>
                {title}
              </h3>
              <p className="text-[10px] sm:text-xs text-muted font-secondary mt-0.5">
                {year ? `${year} • ` : ''}{type === 'tv' ? 'Series' : 'Movie'}
              </p>
            </div>

            {/* Scrollable Content */}
            <div className="overflow-y-auto sm:overflow-y-visible pr-1 -mr-1 flex-1 space-y-3">
              {/* Watch Status Section */}
              <div>
                <span className="text-[10px] text-muted font-secondary uppercase tracking-wider font-semibold">
                  Watch Status
                </span>
                <div className="space-y-1 mt-2">
                  {STATUS_OPTIONS.map((opt) => {
                    const isActive = currentStatus === opt.key;
                    return (
                      <button
                        key={opt.key}
                        disabled={isMutating}
                        onClick={() => handleStatusChange(opt.key)}
                        className={`flex items-center justify-between w-full px-3 py-2 sm:px-2.5 sm:py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                          isActive
                            ? 'bg-red-600/10 border-red-500/30 text-red-500 shadow-md shadow-red-500/5'
                            : 'bg-surface-hover border-border-subtle text-secondary hover:text-primary hover:bg-card hover:border-border'
                        } ${isMutating ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-base opacity-80">{opt.icon}</span>
                          <span className="font-secondary">{opt.label}</span>
                        </div>
                        {isActive && (
                          <span className="material-symbols-outlined text-base text-red-500 font-bold">check</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Lists Section */}
              {isMobile ? (
                <div>
                  <button
                    onClick={() => setIsListsExpanded(!isListsExpanded)}
                    className="flex items-center justify-between w-full py-2 text-xs text-muted font-secondary uppercase tracking-wider font-semibold border-t border-border-subtle transition-colors hover:text-primary"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg opacity-80">playlist_add</span>
                      <span>Custom Lists</span>
                    </div>
                    <span
                      className="material-symbols-outlined text-lg transition-transform duration-200"
                      style={{ transform: isListsExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    >
                      expand_more
                    </span>
                  </button>

                  {/* Collapsible Content */}
                  <AnimatePresence initial={false}>
                    {isListsExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="pb-2 pt-1 space-y-1 max-h-48 overflow-y-auto pr-1">
                          {isLoadingMembership ? (
                            <div className="space-y-2 py-2">
                              {[1, 2, 3].map(i => (
                                <div key={i} className="h-8 w-full bg-surface-hover rounded animate-pulse" />
                              ))}
                            </div>
                          ) : sortedLists.length > 0 ? (
                            sortedLists.map((list) => {
                              const isMember = selectedListIds.includes(list.id);
                              return (
                                <label
                                  key={list.id}
                                  className={`flex items-center justify-between w-full px-3 py-2 text-sm text-secondary hover:text-primary hover:bg-surface-hover rounded-lg transition-colors cursor-pointer select-none ${isMutating ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <AnimatedCheckbox
                                      checked={isMember}
                                      disabled={isMutating || isLoadingMembership}
                                      onChange={() => handleToggleList(list.id)}
                                    />
                                    <span className="font-secondary truncate">{list.name}</span>
                                  </div>
                                  {list.isPinned && (
                                    <span
                                      className="material-symbols-outlined text-yellow-500 text-sm flex-shrink-0"
                                      style={{ fontVariationSettings: "'FILL' 1" }}
                                    >
                                      star
                                    </span>
                                  )}
                                </label>
                              );
                            })
                          ) : (
                            <div className="text-xs text-muted text-center py-4 font-secondary">
                              No custom lists. Create one in the Library!
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <div
                  className="relative"
                  onMouseEnter={() => setHoveringLists(true)}
                  onMouseLeave={() => setHoveringLists(false)}
                >
                  <button
                    className="flex items-center justify-between w-full py-2 text-[10px] text-muted font-secondary uppercase tracking-wider font-semibold border-t border-border-subtle transition-colors hover:text-primary"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base opacity-80">playlist_add</span>
                      <span>Custom Lists</span>
                    </div>
                    <span className="material-symbols-outlined text-base">chevron_right</span>
                  </button>

                  {/* Desktop Hover Submenu */}
                  {hoveringLists && (
                    <div className={`absolute top-0 z-[110] w-[180px] max-h-[220px] overflow-y-auto glass-effect rounded-lg border border-border-subtle bg-surface/98 p-1.5 shadow-2xl ${
                      anchor?.right <= 350 ? 'right-full mr-2' : 'left-full ml-2'
                    }`}>
                      {isLoadingMembership ? (
                        <div className="space-y-1.5 p-1">
                          {[1, 2, 3].map(i => (
                            <div key={i} className="h-6 w-full bg-surface-hover rounded animate-pulse" />
                          ))}
                        </div>
                      ) : sortedLists.length > 0 ? (
                        sortedLists.map((list) => {
                          const isMember = selectedListIds.includes(list.id);
                          return (
                            <label
                              key={list.id}
                              className={`flex items-center justify-between w-full px-2 py-1.5 text-xs text-secondary hover:text-primary hover:bg-surface-hover rounded transition-colors cursor-pointer select-none ${isMutating ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <AnimatedCheckbox
                                  checked={isMember}
                                  disabled={isMutating || isLoadingMembership}
                                  onChange={() => handleToggleList(list.id)}
                                />
                                <span className="font-secondary truncate">{list.name}</span>
                              </div>
                              {list.isPinned && (
                                <span
                                  className="material-symbols-outlined text-yellow-500 text-xs flex-shrink-0"
                                  style={{ fontVariationSettings: "'FILL' 1" }}
                                >
                                  star
                                </span>
                              )}
                            </label>
                          );
                        })
                      ) : (
                        <div className="text-[10px] text-muted text-center py-3 font-secondary">
                          No custom lists.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Danger Zone Section */}
              {isInLibrary && (
                <div className="border-t border-border-subtle pt-3">
                  {!showConfirmDelete ? (
                    <button
                      onClick={() => setShowConfirmDelete(true)}
                      disabled={isMutating}
                      className="flex items-center justify-center gap-2 w-full px-4 py-2 sm:py-1.5 rounded-lg border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/20 hover:text-red-300 font-semibold transition-all text-xs font-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                      <span>Remove From Library</span>
                    </button>
                  ) : (
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-2.5 text-center">
                      <p className="text-[10px] text-red-300 font-secondary font-medium leading-relaxed mb-2">
                        Are you sure? This will remove the item from all custom lists and erase tracking history.
                      </p>
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={handleRemoveFromLibrary}
                          disabled={isRemoving}
                          className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-[10px] font-bold font-secondary transition-colors"
                        >
                          {isRemoving ? 'Removing...' : 'Confirm'}
                        </button>
                        <button
                          onClick={() => setShowConfirmDelete(false)}
                          disabled={isRemoving}
                          className="px-2.5 py-1 rounded bg-surface-hover hover:bg-surface text-primary text-[10px] font-semibold font-secondary transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default QuickActionsModal;
