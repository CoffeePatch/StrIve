import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import LibraryGrid from './LibraryGrid';

const MobileLibraryView = ({
  activePrimaryTab,
  setActivePrimaryTab,
  activeTab,
  setActiveTab,
  sortBy,
  setSortBy,
  items,
  filteredItems,
  loading,
  searchQuery,
  setSearchQuery,
  customLists,
  selectedListId,
  setSelectedListId,
  handleItemClick,
  handleRemove,
  getImdbRating,
  getImdbVotes,
  message
}) => {
  const navigate = useNavigate();
  const [showSortMenu, setShowSortMenu] = useState(false);

  // Client-side filtering by media type
  const displayItems = activePrimaryTab === 'movies'
    ? filteredItems.filter(item => item.media_type === 'movie' || item.mediaType === 'movie')
    : activePrimaryTab === 'shows'
    ? filteredItems.filter(item => item.media_type === 'tv' || item.mediaType === 'tv' || item.first_air_date)
    : filteredItems; // 'lists' shows everything in the list

  // Primary Tabs click handlers
  const handleTabClick = (tab) => {
    setActivePrimaryTab(tab);
    if (tab === 'lists') {
      setActiveTab('custom');
    } else if (activeTab === 'custom') {
      // If switching away from lists, default back to watchlist
      setActiveTab('watchlist');
    }
  };

  const handleFilterClick = (filter) => {
    // If tapping the already active filter, we could clear it, but for V1 we keep it simple single-select
    setActiveTab(filter);
  };

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
        {['movies', 'shows', 'lists'].map((tab) => (
          <button
            key={tab}
            onClick={() => handleTabClick(tab)}
            className={`flex-1 flex items-center justify-center text-[15px] font-semibold transition-colors z-10 ${
              activePrimaryTab === tab ? 'text-white' : 'text-[#9CA3AF]'
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
        {/* Animated Indicator */}
        <div 
          className="absolute bottom-0 h-[3px] bg-[#E50914] transition-all duration-200 ease-out z-20"
          style={{
            width: '33.333%',
            transform: `translateX(${
              activePrimaryTab === 'movies' ? '0%' : activePrimaryTab === 'shows' ? '100%' : '200%'
            })`
          }}
        />
      </div>

      {/* Filter Chips Row (Hidden when Lists is active) */}
      {activePrimaryTab !== 'lists' && (
        <div className="flex justify-between gap-2 px-4 py-3 border-b border-white/5">
          {[
            { id: 'watchlist', label: 'Plan to Watch' },
            { id: 'watching', label: 'Watching' },
            { id: 'watched', label: 'Completed' }
          ].map((filter) => (
            <button
              key={filter.id}
              onClick={() => handleFilterClick(filter.id)}
              className={`flex-1 whitespace-nowrap px-2 py-1.5 rounded-full text-[13px] font-medium transition-colors border ${
                activeTab === filter.id
                  ? 'bg-[#E50914] text-white border-[#E50914]'
                  : 'bg-white/5 text-[#E5E7EB] border-white/10 hover:bg-white/10'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      )}

      {/* Sort Controls Row (Hidden when on the root Lists view) */}
      {!(activePrimaryTab === 'lists' && !selectedListId) && (
        <div className="flex justify-between items-center px-4 h-12">
          <span className="text-[13px] text-[#9CA3AF]">
            {displayItems.length} item{displayItems.length !== 1 ? 's' : ''}
          </span>
          
          <div className="relative">
            <button
              onClick={() => setShowSortMenu(!showSortMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-transparent rounded-lg text-[13px] text-white"
            >
              <span>Sort</span>
              <span className="material-symbols-outlined text-[16px]">expand_more</span>
            </button>

            {showSortMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowSortMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 w-48 bg-gray-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
                  {[
                    { id: 'rating-desc', label: 'IMDb: High to Low' },
                    { id: 'rating-asc', label: 'IMDb: Low to High' },
                    { id: 'date', label: 'Newest Added' }
                  ].map(option => (
                    <button
                      key={option.id}
                      onClick={() => {
                        setSortBy(option.id);
                        setShowSortMenu(false);
                      }}
                      className="w-full text-left px-4 py-3 text-sm text-white hover:bg-white/10 flex justify-between items-center"
                    >
                      <span>{option.label}</span>
                      {sortBy === option.id && (
                        <span className="material-symbols-outlined text-[16px] text-[#E50914]">check</span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

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
        ) : activePrimaryTab === 'lists' && !selectedListId ? (
          // Grid of Custom Lists
          <div className="grid grid-cols-2 gap-3 pt-2">
            {customLists.map(list => (
              <div
                key={list.id}
                onClick={() => setSelectedListId(list.id)}
                className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between aspect-video cursor-pointer hover:bg-white/10 transition-colors"
              >
                <h3 className="font-semibold text-white truncate">{list.name}</h3>
                <span className="text-xs text-white/50">{list.items?.length || 0} items</span>
              </div>
            ))}
            {customLists.length === 0 && (
              <div className="col-span-2 text-center py-10 text-white/50 text-sm">
                No custom lists found.
              </div>
            )}
          </div>
        ) : displayItems.length > 0 ? (
          // Media Grid
          <>
            {activePrimaryTab === 'lists' && selectedListId && (
              <div className="mb-4 flex items-center gap-2">
                <button 
                  onClick={() => setSelectedListId(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-white/10 text-white"
                >
                  <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                </button>
                <h2 className="text-white font-semibold">
                  {customLists.find(l => l.id === selectedListId)?.name}
                </h2>
              </div>
            )}
            
            {/* Custom wrapper to force 2 columns on mobile */}
            <div className="mobile-grid-override">
              <LibraryGrid 
                items={displayItems}
                viewMode="grid"
                handleItemClick={handleItemClick}
                handleRemove={handleRemove}
                getImdbRating={getImdbRating}
                getImdbVotes={getImdbVotes}
              />
            </div>
          </>
        ) : (
          // Empty State
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <span className="material-symbols-outlined text-5xl text-white/20 mb-4">
              inbox
            </span>
            <p className="text-white/60 text-sm max-w-[200px]">
              {activePrimaryTab === 'movies' ? "No movies found." : activePrimaryTab === 'shows' ? "No shows found." : "This list is empty."}
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default MobileLibraryView;
