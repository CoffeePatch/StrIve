import React, { useState } from 'react';
import { useLists } from '../../domain/lists/useLists';
import { validateListName, canPinMoreLists } from '../../domain/lists/listValidators';

const CreateListModal = ({ isOpen, onClose, userId }) => {
  const [listName, setListName] = useState('');
  const [isPinned, setIsPinned] = useState(false);
  const { createNewList, lists, listsStatus, listsError } = useLists(userId);
  const [validationError, setValidationError] = useState('');

  if (!isOpen) return null;

  const pinnedCount = lists?.filter(l => l.isPinned).length || 0;
  const canPin = canPinMoreLists(pinnedCount);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const errorMsg = validateListName(listName, lists);
    if (errorMsg) {
      setValidationError(errorMsg);
      return;
    }
    
    setValidationError('');

    try {
      await createNewList({
        name: listName.trim(),
        isPinned: isPinned && canPin
      });
      setListName('');
      setIsPinned(false);
      onClose();
    } catch (err) {
      console.error('Failed to create list:', err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glass-effect rounded-2xl p-8 w-full max-w-md mx-4 border border-white/20 shadow-2xl">
        <h2 className="text-2xl font-bold font-display text-white mb-6 flex items-center gap-3">
          <span className="material-symbols-outlined text-3xl text-red-600">add_circle</span>
          Create New List
        </h2>
        
        {(listsError || validationError) && (
          <div className="mb-4 p-3 bg-red-600/20 border border-red-600/50 text-red-400 rounded-lg font-secondary text-sm">
            {validationError || listsError}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="listName" className="block text-sm font-medium text-white/90 mb-2 font-secondary">
              List Name
            </label>
            <input
              type="text"
              id="listName"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              className="w-full px-4 py-3 bg-black/40 border border-white/20 rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent font-secondary"
              placeholder="e.g., Watch Later, Action Movies"
              disabled={listsStatus === 'loading'}
              required
              autoFocus
            />
          </div>

          <div className="mb-6">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={isPinned}
                  onChange={(e) => setIsPinned(e.target.checked)}
                  disabled={!canPin || listsStatus === 'loading'}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-700 rounded-full peer-checked:bg-yellow-600 peer-disabled:opacity-50 transition-colors"></div>
                <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
              </div>
              <div className="flex-1">
                <span className="text-white font-secondary flex items-center gap-2">
                  <span className="material-symbols-outlined text-yellow-400 text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                    star
                  </span>
                  Pin this list
                </span>
                <p className="text-white/50 text-xs mt-1 font-secondary">
                  {canPin 
                    ? `Pinned lists appear first (${pinnedCount}/5 used)` 
                    : 'Maximum 5 lists can be pinned'}
                </p>
              </div>
            </label>
          </div>
          
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-white/70 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-all font-secondary border border-white/10"
              disabled={listsStatus === 'loading'}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={listsStatus === 'loading' || !listName.trim()}
              className={`px-5 py-2.5 text-sm font-medium text-white rounded-lg transition-all font-secondary flex items-center gap-2 ${
                listsStatus === 'loading' || !listName.trim()
                  ? 'bg-red-600/50 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700 hover:shadow-[0_0_20px_rgba(220,38,38,0.4)]'
              }`}
            >
              {listsStatus === 'loading' && (
                <span className="material-symbols-outlined animate-spin text-base">progress_activity</span>
              )}
              <span>{listsStatus === 'loading' ? 'Creating...' : 'Create List'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateListModal;