import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLists } from '../../domain/lists/useLists';
import { useListMembership } from '../../domain/lists/useListMembership';
import { RESERVED_LIST_NAMES } from '../../domain/lists/listConstants';

const RESERVED_STATUS_IDS = new Set([
  'Plan to Watch',
  'Completed',
  'Watching',
  'Dropped',
]);

const AddToListPopover = ({ userId, mediaItem, onCreateNew, isOpen }) => {
  const { lists: customLists } = useLists(userId);
  const { getItemMemberships, setItemMemberships, addMediaToList, removeMediaFromList } = useListMembership(userId);

  const [savedListIds, setSavedListIds] = useState([]);
  const [selectedListIds, setSelectedListIds] = useState([]);
  const [isLoadingMembership, setIsLoadingMembership] = useState(false);
  const [membershipLoadedKey, setMembershipLoadedKey] = useState(null);
  const persistTimeoutRef = useRef(null);
  const isPersistingRef = useRef(false);

  const isReady = Boolean(userId && mediaItem?.id);
  const membershipKey = isReady ? `${userId}:${String(mediaItem.id)}` : null;
  const shouldShowMembershipLoading = Boolean(
    isOpen && membershipKey && membershipLoadedKey !== membershipKey
  );

  // Only show true custom lists (and defensively exclude reserved system statuses).
  const availableLists = useMemo(() => {
    const lists = customLists || [];
    return lists.filter((list) => list && !RESERVED_STATUS_IDS.has(list.name) && !RESERVED_LIST_NAMES.includes(list.name?.toLowerCase()));
  }, [customLists]);

  // Sort lists: pinned first (max 5), then by creation date
  const sortedLists = [...availableLists].sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    if (a.isPinned && b.isPinned) {
      return new Date(b.pinnedAt) - new Date(a.pinnedAt);
    }
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  // Separate pinned and unpinned lists
  const pinnedLists = sortedLists.filter(list => list.isPinned).slice(0, 5);
  const unpinnedLists = sortedLists.filter(list => !list.isPinned);

  const isChecked = (listId) => selectedListIds.includes(listId);

  const toggleListId = (listId) => {
    setSelectedListIds((prev) => {
      if (prev.includes(listId)) return prev.filter((id) => id !== listId);
      return [...prev, listId];
    });
  };

  // Load existing membership when opened.
  useEffect(() => {
    let cancelled = false;
    const keyAtStart = membershipKey;

    const load = async () => {
      if (!isOpen || !isReady || !keyAtStart) return;
      try {
        setIsLoadingMembership(true);
        setMembershipLoadedKey(null);
        const listIds = await getItemMemberships(mediaItem);
        if (cancelled) return;
        const normalized = Array.isArray(listIds) ? listIds.filter(Boolean) : [];
        setSavedListIds(normalized);
        setSelectedListIds(normalized);
      } catch (err) {
        console.warn('Failed to load listIds for AddToListPopover:', err);
        if (!cancelled) {
          setSavedListIds([]);
          setSelectedListIds([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingMembership(false);
          setMembershipLoadedKey(keyAtStart);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [isOpen, isReady, userId, mediaItem, membershipKey]);

  // Debounced persist of listIds to Firestore.
  useEffect(() => {
    if (!isOpen || !isReady || shouldShowMembershipLoading || isLoadingMembership) return;
    if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);

    persistTimeoutRef.current = setTimeout(async () => {
      if (isPersistingRef.current) return;
      const next = [...new Set(selectedListIds)].filter(Boolean);
      const prev = savedListIds;
      const prevSet = new Set(prev);
      const nextSet = new Set(next);
      const changed = next.length !== prev.length || next.some((id) => !prevSet.has(id));

      if (!changed) return;

      const toAdd = next.filter((id) => !prevSet.has(id));
      const toRemove = prev.filter((id) => !nextSet.has(id));

      isPersistingRef.current = true;
      try {
        await setItemMemberships(mediaItem, next);

        await Promise.all([
          ...toAdd.map((listId) =>
            addMediaToList(listId, mediaItem)
          ),
          ...toRemove.map((listId) =>
            removeMediaFromList(listId, mediaItem.id)
          ),
        ]);
        setSavedListIds(next);
      } catch (err) {
        console.error('Failed to update listIds:', err);
        try {
          await setItemMemberships(mediaItem, prev);
        } catch (rollbackErr) {
          console.warn('Failed to rollback listIds:', rollbackErr);
        }
        // Revert optimistic UI to last saved state.
        setSelectedListIds(prev);
        alert('Failed to update lists. Please try again.');
      } finally {
        isPersistingRef.current = false;
      }
    }, 350);

    return () => {
      if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    };
  }, [
    selectedListIds,
    savedListIds,
    isOpen,
    isReady,
    shouldShowMembershipLoading,
    isLoadingMembership,
    userId,
    mediaItem,
    setItemMemberships,
    addMediaToList,
    removeMediaFromList,
  ]);

  if (!isOpen) return null;

  const disableInputs = !isReady || shouldShowMembershipLoading || isLoadingMembership;

  return (
    <div 
      className="absolute left-0 mt-2 w-72 glass-effect backdrop-blur-xl rounded-xl shadow-2xl z-50 border border-white/20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
      onMouseDown={(e) => e.stopPropagation()}
      onMouseEnter={(e) => e.stopPropagation()}
    >
      <div className="py-2 max-h-96 overflow-y-auto">
        {/* Pinned Lists Section */}
        {pinnedLists.length > 0 && (
          <>
            <div className="px-4 py-2 text-xs text-white/40 font-secondary uppercase tracking-wider">
              Pinned Lists
            </div>
            {pinnedLists.map((list) => (
              <label
                key={list.id}
                className="group flex items-center justify-between w-full px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-all cursor-pointer select-none"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <input
                    type="checkbox"
                    checked={isChecked(list.id)}
                    disabled={disableInputs}
                    onChange={() => toggleListId(list.id)}
                    className="h-4 w-4"
                  />
                  <span className="font-secondary truncate">{list.name}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-white/40">{list.items?.length || 0}</span>
                  <span
                    className="material-symbols-outlined text-yellow-400 text-base"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    star
                  </span>
                </div>
              </label>
            ))}
            {unpinnedLists.length > 0 && <div className="border-t border-white/10 my-2"></div>}
          </>
        )}

        {/* Other Lists Section */}
        {unpinnedLists.length > 0 && (
          <>
            {pinnedLists.length > 0 && (
              <div className="px-4 py-2 text-xs text-white/40 font-secondary uppercase tracking-wider">
                Other Lists
              </div>
            )}
            {unpinnedLists.map((list) => (
              <label
                key={list.id}
                className="group flex items-center justify-between w-full px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-all cursor-pointer select-none"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <input
                    type="checkbox"
                    checked={isChecked(list.id)}
                    disabled={disableInputs}
                    onChange={() => toggleListId(list.id)}
                    className="h-4 w-4"
                  />
                  <span className="font-secondary truncate">{list.name}</span>
                </div>
                <span className="text-xs text-white/40 flex-shrink-0">{list.items?.length || 0}</span>
              </label>
            ))}
          </>
        )}

        {sortedLists.length === 0 && (
          <div className="px-4 py-3 text-sm text-white/50 font-secondary text-center">
            No lists yet
          </div>
        )}

        {sortedLists.length > 0 && <div className="border-t border-white/10 my-2"></div>}
        
        {/* Create New List Option */}
        <button
          onClick={onCreateNew}
          className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-600/20 transition-all font-secondary"
        >
          <span className="material-symbols-outlined text-base">add</span>
          <span>Create new list</span>
        </button>
      </div>
    </div>
  );
};

export default AddToListPopover;