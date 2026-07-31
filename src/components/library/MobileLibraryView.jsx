import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import LibraryGrid from './LibraryGrid';
import { useLibraryFiltersContext } from '../../hooks/library/LibraryFiltersContext';
import LibraryFilterSheet from './LibraryFilterSheet';
import { toDisplayWatchStatus } from '../../util/library/watchStatus';

const MobileLibraryView = ({
  headerProps = {},
  filterProps = {},
  gridProps = {},
  activePrimaryTab,
  setActivePrimaryTab,
  items: directItems,
  filteredItems: directFilteredItems,
  loading: directLoading,
  customLists: directCustomLists,
  handleItemClick: directHandleItemClick,
  handleRemove: directHandleRemove,
  onQuickActions: directOnQuickActions,
  getImdbRating: directGetImdbRating,
  getImdbVotes: directGetImdbVotes,
  message: directMessage
}) => {
  const navigate = useNavigate();
  const filters = useLibraryFiltersContext();
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  const items = directItems ?? gridProps.items ?? [];
  const filteredItems = directFilteredItems ?? gridProps.items ?? [];
  const loading = directLoading ?? false;
  const customLists = directCustomLists ?? filterProps.customLists ?? [];
  const handleItemClick = directHandleItemClick ?? gridProps.handleItemClick;
  const handleRemove = directHandleRemove ?? gridProps.handleRemove;
  const onQuickActions = directOnQuickActions ?? gridProps.onQuickActions;
  const getImdbRating = directGetImdbRating ?? gridProps.getImdbRating;
  const getImdbVotes = directGetImdbVotes ?? gridProps.getImdbVotes;
  const message = directMessage;

  const {
    searchQuery,
    setSearchQuery,
    status,
    type,
    genres,
    runtimes,
    imdbRatingMin,
    yearFrom,
    yearTo,
    customListIds,
    activeSecondaryFilterCount
  } = filters;

  // Primary Tabs click handlers
  const handleTabClick = (tab) => {
    setActivePrimaryTab(tab);
  };

  // Active filters summary text under header
  const activeFilterSummaryText = useMemo(() => {
    const parts = [];

    // Watch Status
    if (status !== 'all') {
      const displayStatus = status.split(',').map(toDisplayWatchStatus).join(', ');
      parts.push(displayStatus);
    }

    // Media Type (Movies, TV Shows, Anime)
    if (type !== 'all') {
      const displayType = type.split(',').map(t => {
        if (t === 'movie') return 'Movies';
        if (t === 'tv' || t === 'series') return 'TV Shows';
        return t.charAt(0).toUpperCase() + t.slice(1);
      }).join(', ');
      parts.push(displayType);
    }

    // Year range
    if (yearFrom || yearTo) {
      parts.push(`Year: ${yearFrom || '...'} - ${yearTo || '...'}`);
    }

    // Rating
    if (imdbRatingMin) {
      parts.push(`IMDb: ${imdbRatingMin}+`);
    }

    // Genres
    if (genres.length > 0) {
      parts.push(genres.slice(0, 2).join(' • ') + (genres.length > 2 ? '...' : ''));
    }

    // Custom Lists
    if (customListIds.length > 0) {
      const listNames = customListIds.map(id => customLists.find(l => l.id === id)?.name || id).slice(0, 2).join(', ');
      parts.push(`Lists: ${listNames}${customListIds.length > 2 ? '...' : ''}`);
    }

    // Runtimes
    if (runtimes.length > 0) {
      parts.push(`Runtime: ${runtimes.length} filter${runtimes.length > 1 ? 's' : ''}`);
    }

    if (parts.length === 0) return '';
    return parts.join(' • ');
  }, [status, type, genres, runtimes, imdbRatingMin, yearFrom, yearTo, customListIds, customLists]);

  return (
    <div className="min-h-screen bg-background text-primary flex flex-col">
      {/* Top App Bar */}
      <header className="sticky top-0 z-40 h-14 bg-surface/90 backdrop-blur-xl flex items-center justify-between px-4 border-b border-border-subtle">
        <h1 className="text-xl font-semibold text-primary">Library</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/search')}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-hover transition-colors"
            aria-label="Search"
          >
            <span className="material-symbols-outlined text-primary">search</span>
          </button>
        </div>
      </header>

      {/* Primary Tabs */}
      <div className="flex h-12 border-b border-border-subtle relative">
        {['all', 'movies', 'shows'].map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabClick(tab)}
            className={`flex-1 flex items-center justify-center text-[15px] font-semibold transition-colors z-10 ${
              activePrimaryTab === tab ? 'text-primary' : 'text-secondary'
            }`}
          >
            {tab === 'all' ? 'All' : tab === 'movies' ? 'Movies' : 'Shows'}
          </button>
        ))}
        {/* Animated Indicator */}
        <div 
          className="absolute bottom-0 h-[3px] bg-accent transition-all duration-200 ease-out z-20"
          style={{
            width: '33.333%',
            transform: `translateX(${
              activePrimaryTab === 'all' ? '0%' : activePrimaryTab === 'movies' ? '100%' : '200%'
            })`
          }}
        />
      </div>

      {/* Search and Filter Row */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle bg-background">
        {/* Search Input */}
        <div className="flex-1 relative flex items-center bg-surface border border-border-subtle rounded-xl overflow-hidden h-10">
          <span className="material-symbols-outlined text-muted text-[18px] absolute left-3 pointer-events-none">search</span>
          <input
            type="text"
            className="w-full h-full bg-transparent pl-10 pr-8 text-[14px] text-primary placeholder:text-muted focus:outline-none font-secondary"
            placeholder="Search library..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 w-5 h-5 flex items-center justify-center rounded-full bg-surface-hover text-secondary hover:text-primary"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          )}
        </div>

        {/* Filter Trigger Button */}
        <button
          onClick={() => setFilterSheetOpen(true)}
          className={`h-10 px-4 rounded-xl text-[13px] font-semibold flex items-center gap-1.5 border transition-all ${
            activeSecondaryFilterCount > 0
              ? 'bg-accent/10 border-accent/30 text-accent shadow-md shadow-accent/5'
              : 'bg-surface border-border-subtle text-secondary'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">tune</span>
          <span>Filter</span>
          {activeSecondaryFilterCount > 0 && (
            <span className="bg-accent text-inverse text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {activeSecondaryFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Active Filter Summary Row */}
      {activeSecondaryFilterCount > 0 && (
        <div 
          onClick={() => setFilterSheetOpen(true)}
          className="px-4 py-2 bg-surface border-b border-border-subtle flex items-center gap-2 overflow-x-auto hide-scrollbar cursor-pointer select-none active:bg-surface-hover transition-colors"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0 animate-pulse" />
          <span className="text-[12px] font-medium text-secondary whitespace-nowrap truncate flex-1 pr-4">
            {activeFilterSummaryText}
          </span>
          <span className="material-symbols-outlined text-muted text-[14px] ml-auto">chevron_right</span>
        </div>
      )}

      {/* Count Info Area */}
      <div className="flex justify-between items-center px-4 h-10">
        <span className="text-[13px] text-secondary">
          {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Content Area */}
      <main className="flex-1 pb-24 px-4 relative">
        {message && (
          <div className={`px-4 py-3 rounded-lg mb-4 text-sm ${
            message.type === 'error' ? 'bg-error/20 text-error' : 'bg-success/20 text-success'
          }`}>
            {message.text}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-border-subtle border-t-accent mb-4" />
            <p className="text-secondary text-sm">Loading...</p>
          </div>
        ) : filteredItems.length > 0 ? (
          // Media Grid
          <div className="mobile-grid-override">
            <LibraryGrid 
              items={filteredItems}
              viewMode="grid"
              handleItemClick={handleItemClick}
              handleRemove={handleRemove}
              onQuickActions={onQuickActions}
              getImdbRating={getImdbRating}
              getImdbVotes={getImdbVotes}
              isMobileView={true}
            />
          </div>
        ) : (
          // Empty State
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="material-symbols-outlined text-5xl text-muted mb-4">
              inbox
            </span>
            <p className="text-secondary text-sm max-w-[200px]">
              {activePrimaryTab === 'movies' ? "No movies found." : activePrimaryTab === 'shows' ? "No shows found." : "No items found."}
            </p>
          </div>
        )}
      </main>

      {/* Filter Bottom Sheet */}
      <LibraryFilterSheet
        isOpen={filterSheetOpen}
        onClose={() => setFilterSheetOpen(false)}
        items={items}
        customLists={customLists}
      />
    </div>
  );
};

export default MobileLibraryView;
