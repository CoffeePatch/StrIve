import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence } from 'framer-motion';
import { useMotionPreferences } from '../../hooks/useMotionPreferences';

const SORT_OPTIONS = [
  { id: 'imdb', label: 'IMDb' },
  { id: 'tmdb', label: 'TMDB' },
  { id: 'dateAdded', label: 'Date Added' },
  { id: 'dateUpdated', label: 'Date Updated' },
  { id: 'lastWatched', label: 'Last Watched' },
  { id: 'releaseYear', label: 'Release Year' },
  { id: 'title', label: 'Title' },
];

const SortBottomSheet = ({ isOpen, onClose, sortState, onSortChange }) => {
  const { spring } = useMotionPreferences();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleOptionClick = (optionId) => {
    if (sortState.key === optionId) {
      // Toggle direction if clicking the active option
      onSortChange({
        key: optionId,
        direction: sortState.direction === 'asc' ? 'desc' : 'asc'
      });
    } else {
      // Switch key and default to desc
      onSortChange({
        key: optionId,
        direction: 'desc'
      });
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center md:items-center sm:p-4" style={{ pointerEvents: isOpen ? 'auto' : 'none' }}>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-backdrop backdrop-blur-sm"
          />

          {/* Bottom Sheet / Modal */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={spring}
            className="w-full bg-surface rounded-t-3xl md:rounded-2xl md:max-w-sm overflow-hidden z-10 border border-border-subtle flex flex-col"
            style={{ maxHeight: '90vh' }}
          >
            {/* Handle bar for mobile */}
            <div className="w-full flex justify-center pt-3 pb-1 md:hidden">
              <div className="w-12 h-1.5 bg-divider rounded-full" />
            </div>

            <div className="px-6 py-4 flex justify-between items-center border-b border-border-subtle">
              <h2 className="text-lg font-bold text-primary">Sort By</h2>
              <button 
                onClick={onClose}
                className="p-1 rounded-full hover:bg-surface-hover text-secondary transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto hide-scrollbar py-2">
              {SORT_OPTIONS.map((option) => {
                const isActive = sortState?.key === option.id;
                
                return (
                  <button
                    key={option.id}
                    onClick={() => handleOptionClick(option.id)}
                    className={`w-full px-6 py-3.5 flex items-center justify-between transition-colors ${
                      isActive ? 'bg-surface-hover' : 'hover:bg-surface-hover'
                    }`}
                  >
                    <span className={`text-[15px] font-medium ${isActive ? 'text-accent' : 'text-primary'}`}>
                      {option.label}
                    </span>
                    
                    {isActive && (
                      <span className="material-symbols-outlined text-accent text-[20px]">
                        {sortState.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                      </span>
                    )}
                    {!isActive && (
                      <span className="material-symbols-outlined text-muted text-[20px]">
                        arrow_downward
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default SortBottomSheet;
