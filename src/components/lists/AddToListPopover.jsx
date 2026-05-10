import React from 'react';
import { useSelector } from 'react-redux';

const AddToListPopover = ({ onSelectList, onCreateNew, isOpen }) => {
  const { customLists } = useSelector((state) => state.lists);

  if (!isOpen) return null;

  // Sort lists: pinned first (max 5), then by creation date
  const sortedLists = [...(customLists.lists || [])].sort((a, b) => {
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

  return (
    <div 
      className="absolute left-0 mt-2 w-72 glass-effect backdrop-blur-xl rounded-xl shadow-2xl z-50 border border-white/20 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200"
      onMouseDown={(e) => e.stopPropagation()}
      onMouseEnter={(e) => e.stopPropagation()}
    >
      <div className="py-2 max-h-96 overflow-y-auto">
        {/* System Library Actions */}
        <div className="px-4 py-2 text-xs text-white/40 font-secondary uppercase tracking-wider">
          Library Actions
        </div>
        <button
          onClick={() => onSelectList({ kind: 'system', action: 'watchlist' })}
          className="group flex items-center justify-between w-full px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-all"
        >
          <span className="font-secondary truncate flex-1 text-left">Add to Watchlist</span>
          <span className="material-symbols-outlined text-base text-white/50">bookmark</span>
        </button>
        <button
          onClick={() => onSelectList({ kind: 'system', action: 'completed' })}
          className="group flex items-center justify-between w-full px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-all"
        >
          <span className="font-secondary truncate flex-1 text-left">Mark as Completed</span>
          <span className="material-symbols-outlined text-base text-white/50">check_circle</span>
        </button>
        <div className="border-t border-white/10 my-2"></div>

        {/* Pinned Lists Section */}
        {pinnedLists.length > 0 && (
          <>
            <div className="px-4 py-2 text-xs text-white/40 font-secondary uppercase tracking-wider">
              Pinned Lists
            </div>
            {pinnedLists.map((list) => (
              <button
                key={list.id}
                onClick={() => onSelectList({ kind: 'custom', listId: list.id })}
                className="group flex items-center justify-between w-full px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-all"
              >
                <span className="font-secondary truncate flex-1 text-left">{list.name}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-white/40">{list.items?.length || 0}</span>
                  <span 
                    className="material-symbols-outlined text-yellow-400 text-base"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    star
                  </span>
                </div>
              </button>
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
              <button
                key={list.id}
                onClick={() => onSelectList({ kind: 'custom', listId: list.id })}
                className="group flex items-center justify-between w-full px-4 py-2.5 text-sm text-white hover:bg-white/10 transition-all"
              >
                <span className="font-secondary truncate flex-1 text-left">{list.name}</span>
                <span className="text-xs text-white/40 flex-shrink-0">{list.items?.length || 0}</span>
              </button>
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