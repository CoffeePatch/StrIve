import React from 'react';
import LibraryMediaCard from './LibraryMediaCard';
import { useGridVirtualization } from '../../hooks/library/useGridVirtualization';
import { useLibrarySelection } from '../../context/LibrarySelectionContext';

const LibraryGrid = ({ 
  items, 
  viewMode, 
  handleItemClick, 
  handleRemove, 
  onQuickActions,
  getImdbRating, 
  getImdbVotes,
  isMobileView = false 
}) => {

  const gapSize = isMobileView
    ? (window.innerWidth < 768 ? 8 : 12)
    : (viewMode === 'wide' || viewMode === 'bookshelf' ? 16 : 24);

  const defaultCardHeight = isMobileView
    ? 165
    : (viewMode === 'wide' || viewMode === 'bookshelf' ? 134 : 330);

  const noVirtual = new URLSearchParams(window.location.search).get('noVirtual') === 'true';

  const {
    containerRef,
    visibleItems,
    topPadding,
    bottomPadding
  } = useGridVirtualization({
    items: noVirtual ? [] : items,
    viewMode,
    isMobileView,
    gapSize,
    defaultCardHeight
  });

  const displayItems = noVirtual ? items : visibleItems;
  const computedTopPadding = noVirtual ? 0 : topPadding;
  const computedBottomPadding = noVirtual ? 0 : bottomPadding;
  
  const selectionContext = useLibrarySelection();
  const isSelectionMode = selectionContext?.isSelectionMode;
  const isItemSelected = selectionContext?.isItemSelected;
  const toggleSelectItem = selectionContext?.toggleSelectItem;
  const selectRange = selectionContext?.selectRange;
  const enterSelectionMode = selectionContext?.enterSelectionMode;

  return (
    <div
      ref={containerRef}
      style={{
        paddingTop: `${computedTopPadding}px`,
        paddingBottom: `${computedBottomPadding}px`
      }}
      className={
        viewMode === 'wide' || viewMode === 'bookshelf'
          ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
          : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6'
      }
    >
      {displayItems.map((item) => (
        <LibraryMediaCard
          key={`${item.media_type || item.mediaType}-${item.id}`}
          item={item}
          allItems={items}
          viewMode={viewMode}
          onClick={handleItemClick}
          onRemove={handleRemove}
          onQuickActions={onQuickActions}
          imdbRating={getImdbRating ? getImdbRating(item) : undefined}
          imdbVotes={getImdbVotes ? getImdbVotes(item) : undefined}
          isSelectionMode={isSelectionMode}
          isSelected={isItemSelected ? isItemSelected(item) : false}
          onToggleSelect={toggleSelectItem}
          onSelectRange={selectRange}
          onEnterSelectionMode={enterSelectionMode}
          data-card-item="true"
        />
      ))}
    </div>
  );
};

export default React.memo(LibraryGrid);
