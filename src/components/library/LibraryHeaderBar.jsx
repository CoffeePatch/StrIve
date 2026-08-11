import React, { useState } from 'react';
import { AnimatedIconButton } from '../ui/AnimatedPrimitives';
import { useLibrarySelection } from '../../context/LibrarySelectionContext';

const SORT_OPTIONS = [
  { id: 'imdb', label: 'IMDb' },
  { id: 'tmdb', label: 'TMDB' },
  { id: 'dateAdded', label: 'Date Added' },
  { id: 'dateUpdated', label: 'Date Updated' },
  { id: 'lastWatched', label: 'Last Watched' },
  { id: 'releaseYear', label: 'Release Year' },
  { id: 'title', label: 'Title' },
];

const LibraryHeaderBar = ({
  itemCount = 0,
  searchQuery = '',
  setSearchQuery,
  viewMode = 'grid',
  setViewMode,
  sortState = { key: 'tmdb', direction: 'desc' },
  setSortState,
  onImportClick,
}) => {
  const [searchFocused, setSearchFocused] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const { isSelectionMode, toggleSelectionMode } = useLibrarySelection();

  return (
    <div className="flex justify-between items-end px-8 max-w-[1440px] mx-auto w-full mb-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-[32px] font-bold text-primary leading-none font-display">My Library</h1>
        <span className="text-[14px] text-secondary leading-none mt-1 font-secondary">
          {itemCount} items
        </span>
      </div>

      <div className="flex items-center gap-3">
        {/* Search Input */}
        <div
          className={`relative flex items-center bg-surface border ${
            searchFocused ? 'border-accent' : 'border-border-subtle'
          } rounded-lg transition-all duration-200 overflow-hidden h-[40px]`}
          style={{ width: searchFocused ? '320px' : '240px' }}
        >
          <span className="material-symbols-outlined text-muted text-base absolute left-3 pointer-events-none">
            search
          </span>
          <input
            type="text"
            className="w-full h-full bg-transparent pl-10 pr-3 text-[14px] text-primary placeholder:text-muted focus:outline-none font-secondary"
            placeholder="Search library..."
            value={searchQuery}
            onChange={(e) => setSearchQuery?.(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
          />
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-surface rounded-lg p-1 h-[40px]">
          <AnimatedIconButton
            onClick={toggleSelectionMode}
            className={`w-[36px] h-[32px] rounded flex items-center justify-center transition-colors ${
              isSelectionMode
                ? 'bg-accent text-inverse'
                : 'text-secondary hover:text-primary hover:bg-surface-hover'
            }`}
            title="Multi-Select"
          >
            <span className="material-symbols-outlined text-[18px]">checklist</span>
          </AnimatedIconButton>
          <div className="w-[1px] h-[20px] bg-border-subtle mx-1" />
          <AnimatedIconButton
            onClick={() => setViewMode?.('grid')}
            className={`w-[36px] h-[32px] rounded flex items-center justify-center transition-colors ${
              viewMode === 'grid'
                ? 'bg-accent text-inverse'
                : 'text-secondary hover:text-primary hover:bg-surface-hover'
            }`}
            title="Grid view"
          >
            <span className="material-symbols-outlined text-[18px]">grid_view</span>
          </AnimatedIconButton>
          <AnimatedIconButton
            onClick={() => setViewMode?.('bookshelf')}
            className={`w-[36px] h-[32px] rounded flex items-center justify-center transition-colors ${
              viewMode === 'bookshelf'
                ? 'bg-accent text-inverse'
                : 'text-secondary hover:text-primary hover:bg-surface-hover'
            }`}
            title="Bookshelf view"
          >
            <span className="material-symbols-outlined text-[18px]">view_agenda</span>
          </AnimatedIconButton>
        </div>

        {/* Desktop Sort Dropdown */}
        <div className="relative">
          <button
            onClick={() => setSortDropdownOpen((prev) => !prev)}
            className="bg-surface border border-border-subtle h-[40px] px-4 rounded-lg text-[14px] text-primary focus:outline-none cursor-pointer font-secondary hover:border-border hover:bg-surface-hover transition-colors flex items-center gap-2"
          >
            Sort
            <span className="material-symbols-outlined text-[16px] text-secondary">sort</span>
          </button>

          {sortDropdownOpen && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setSortDropdownOpen(false)}
              />
              <div className="absolute right-[1px] mt-2 w-44 glass-effect rounded-lg border border-border-subtle bg-surface/98 p-1.5 shadow-2xl z-50 flex flex-col">
                {SORT_OPTIONS.map((option) => {
                  const isActive = sortState?.key === option.id;
                  return (
                    <button
                      key={option.id}
                      onClick={() => {
                        if (sortState?.key === option.id) {
                          setSortState?.({
                            key: option.id,
                            direction: sortState.direction === 'asc' ? 'desc' : 'asc',
                          });
                        } else {
                          setSortState?.({
                            key: option.id,
                            direction: 'desc',
                          });
                        }
                        setSortDropdownOpen(false);
                      }}
                      className={`w-full px-2 py-1.5 flex items-center justify-between rounded transition-colors text-xs font-semibold font-secondary ${
                        isActive
                          ? 'bg-accent/10 text-accent font-bold'
                          : 'text-secondary hover:text-primary hover:bg-surface-hover'
                      }`}
                    >
                      <span>{option.label}</span>
                      {isActive && (
                        <span className="material-symbols-outlined text-accent text-sm font-bold">
                          {sortState.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Import Button */}
        <AnimatedIconButton
          onClick={onImportClick}
          className="w-[40px] h-[40px] rounded-lg bg-surface hover:bg-surface-hover border border-border-subtle text-primary flex items-center justify-center transition-colors"
          title="Import from CSV"
        >
          <span className="material-symbols-outlined text-[20px]">upload</span>
        </AnimatedIconButton>
      </div>
    </div>
  );
};

export default React.memo(LibraryHeaderBar);
