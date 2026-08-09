import React from 'react';
import { Reorder } from 'framer-motion';
import { GripVertical } from 'lucide-react';
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
  isMobileView = false,
  isReorderable = false,
  onReorder
}) => {

  const gapSize = isMobileView
    ? (window.innerWidth < 768 ? 8 : 12)
    : (viewMode === 'wide' || viewMode === 'bookshelf' ? 16 : 24);

  const defaultCardHeight = isMobileView
    ? 165
    : (viewMode === 'wide' || viewMode === 'bookshelf' ? 134 : 330);

  const noVirtual = isReorderable || new URLSearchParams(window.location.search).get('noVirtual') === 'true';

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

  const handleReorder = (newOrderedItems) => {
    if (!onReorder) return;
    const movedIdx = newOrderedItems.findIndex((item, idx) => item.titleKey !== items[idx]?.titleKey);
    if (movedIdx === -1) return;

    const movedItem = newOrderedItems[movedIdx];
    const afterItem = newOrderedItems[movedIdx - 1] || null;
    const beforeItem = newOrderedItems[movedIdx + 1] || null;

    onReorder({
      titleKey: movedItem.titleKey,
      afterTitleKey: afterItem?.titleKey || null,
      beforeTitleKey: beforeItem?.titleKey || null,
      newOrderedItems
    });
  };

  const gridClassName = viewMode === 'wide' || viewMode === 'bookshelf'
    ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
    : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6';

  if (isReorderable && onReorder) {
    return (
      <Reorder.Group
        axis="y"
        values={items}
        onReorder={handleReorder}
        className="space-y-3"
      >
        {items.map((item) => (
          <Reorder.Item
            key={item.titleKey || `${item.media_type || item.mediaType}-${item.id}`}
            value={item}
            className="flex items-center gap-3 bg-surface/60 backdrop-blur-md rounded-xl p-2 border border-white/10 hover:border-white/20 transition-all shadow-md group"
          >
            <div className="p-2 cursor-grab active:cursor-grabbing text-muted group-hover:text-primary transition-colors flex-shrink-0" title="Drag to reorder">
              <GripVertical className="w-5 h-5" />
            </div>
            <div className="flex-grow min-w-0">
              <LibraryMediaCard
                item={item}
                allItems={items}
                viewMode="wide"
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
            </div>
          </Reorder.Item>
        ))}
      </Reorder.Group>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        paddingTop: `${computedTopPadding}px`,
        paddingBottom: `${computedBottomPadding}px`
      }}
      className={gridClassName}
    >
      {displayItems.map((item) => (
        <LibraryMediaCard
          key={item.titleKey || `${item.media_type || item.mediaType}-${item.id}`}
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
