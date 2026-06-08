import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { useMotionPreferences } from '../../hooks/useMotionPreferences';
import LibraryMediaCard from './LibraryMediaCard';

const LibraryGrid = ({ items, viewMode, handleItemClick, handleRemove, getImdbRating, getImdbVotes }) => {
  const { spring } = useMotionPreferences();
  const [displayCount, setDisplayCount] = useState(30);
  const loadMoreRef = useRef(null);

  useEffect(() => {
    // Reset display count when items change significantly (e.g., search/filter)
    setDisplayCount(30);
  }, [items.length]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDisplayCount((prev) => Math.min(prev + 30, items.length));
        }
      },
      { rootMargin: '400px' }
    );

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => {
      if (loadMoreRef.current) {
        observer.unobserve(loadMoreRef.current);
      }
    };
  }, [items.length]);

  const displayedItems = items.slice(0, displayCount);

  return (
    <LayoutGroup>
      <motion.div
        layout
        className={
          viewMode === 'wide' || viewMode === 'bookshelf'
            ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
            : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6'
        }
      >
        <AnimatePresence mode="popLayout">
          {displayedItems.map((item) => (
            <LibraryMediaCard
              key={`${item.media_type || item.mediaType}-${item.id}`}
              item={item}
              viewMode={viewMode}
              onClick={() => handleItemClick(item)}
              onRemove={() => handleRemove(item)}
              imdbRating={getImdbRating ? getImdbRating(item) : null}
              imdbVotes={getImdbVotes ? getImdbVotes(item) : null}
            />
          ))}
        </AnimatePresence>
      </motion.div>
      {displayCount < items.length && (
        <div ref={loadMoreRef} className="h-10 w-full mt-4" />
      )}
    </LayoutGroup>
  );
};

export default LibraryGrid;
