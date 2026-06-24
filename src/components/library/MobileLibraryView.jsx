import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import LibraryGrid from './LibraryGrid';
import { useLibraryFiltersContext } from '../../hooks/library/LibraryFiltersContext';
import LibraryFilterSheet from './LibraryFilterSheet';
import { toDisplayWatchStatus } from '../../util/library/watchStatus';

const MobileLibraryView = ({
  activePrimaryTab,
  setActivePrimaryTab,
  items,
  filteredItems,
  loading,
  customLists,
  handleItemClick,
  handleRemove,
  onQuickActions,
  getImdbRating,
  getImdbVotes,
  message
}) => {
  const navigate = useNavigate();
  const filters = useLibraryFiltersContext();
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

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
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Top App Bar */}
      <header className="sticky top-0 z-40 h-14 bg-black/90 backdrop-blur-xl flex items-center justify-between px-4 border-b border-white/5">
        <h1 className="text-xl font-semibold text-white">Library</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/search')}
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
            aria-label="Search"
          >
            <span className="material-symbols-outlined text-white">search</span>
          </button>
        </div>
      </header>

      {/* Primary Tabs */}
      <div className="flex h-12 border-b border-white/10 relative">
        {['all', 'movies', 'shows'].map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabClick(tab)}
            className={`flex-1 flex items-center justify-center text-[15px] font-semibold transition-colors z-10 ${
              activePrimaryTab === tab ? 'text-white' : 'text-[#9CA3AF]'
            }`}
          >
            {tab === 'all' ? 'All' : tab === 'movies' ? 'Movies' : 'Shows'}
          </button>
        ))}
        {/* Animated Indicator */}
        <div 
          className="absolute bottom-0 h-[3px] bg-[#E50914] transition-all duration-200 ease-out z-20"
          style={{
            width: '33.333%',
            transform: `translateX(${
              activePrimaryTab === 'all' ? '0%' : activePrimaryTab === 'movies' ? '100%' : '200%'
            })`
          }}
        />
      </div>

      {/* Search and Filter Row */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-black">
        {/* Search Input */}
        <div className="flex-1 relative flex items-center bg-white/5 border border-white/10 rounded-xl overflow-hidden h-10">
          <span className="material-symbols-outlined text-white/50 text-[18px] absolute left-3 pointer-events-none">search</span>
          <input
            type="text"
            className="w-full h-full bg-transparent pl-10 pr-8 text-[14px] text-white placeholder-white/40 focus:outline-none font-secondary"
            placeholder="Search library..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 w-5 h-5 flex items-center justify-center rounded-full bg-white/10 text-white/60 hover:text-white"
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
              ? 'bg-red-600/10 border-red-500/30 text-red-500 shadow-md shadow-red-500/5'
              : 'bg-white/5 border-white/10 text-white/80'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">tune</span>
          <span>Filter</span>
          {activeSecondaryFilterCount > 0 && (
            <span className="bg-[#E50914] text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center">
              {activeSecondaryFilterCount}
            </span>
          )}
        </button>
      </div>

      {/* Active Filter Summary Row */}
      {activeSecondaryFilterCount > 0 && (
        <div 
          onClick={() => setFilterSheetOpen(true)}
          className="px-4 py-2 bg-white/5 border-b border-white/5 flex items-center gap-2 overflow-x-auto hide-scrollbar cursor-pointer select-none active:bg-white/10 transition-colors"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-red-600 flex-shrink-0 animate-pulse" />
          <span className="text-[12px] font-medium text-white/60 whitespace-nowrap truncate flex-1 pr-4">
            {activeFilterSummaryText}
          </span>
          <span className="material-symbols-outlined text-white/40 text-[14px] ml-auto">chevron_right</span>
        </div>
      )}

      {/* Count Info Area */}
      <div className="flex justify-between items-center px-4 h-10">
        <span className="text-[13px] text-[#9CA3AF]">
          {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Content Area */}
      <main className="flex-1 pb-24 px-4 relative">
        {message && (
          <div className={`px-4 py-3 rounded-lg mb-4 text-sm ${
            message.type === 'error' ? 'bg-red-500/20 text-red-300' : 'bg-green-500/20 text-green-300'
          }`}>
            {message.text}
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-white/20 border-t-[#E50914] mb-4" />
            <p className="text-white/60 text-sm">Loading...</p>
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
            <span className="material-symbols-outlined text-5xl text-white/20 mb-4">
              inbox
            </span>
            <p className="text-white/60 text-sm max-w-[200px]">
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
