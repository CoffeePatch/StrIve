import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Carousel
 * Standard horizontal scroller with snap behavior and scroll buttons
 * 
 * @param {React.ReactNode} children - The cards to render inside the carousel
 * @param {string} className - Additional CSS classes
 * @param {boolean} showControls - Whether to show the left/right scroll buttons on desktop
 */
const Carousel = ({
  children,
  className = "",
  showControls = true
}) => {
  const scrollContainerRef = useRef(null);

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const scrollAmount = container.clientWidth * 0.8; // Scroll 80% of container width
      
      container.scrollTo({
        left: container.scrollLeft + (direction === 'left' ? -scrollAmount : scrollAmount),
        behavior: 'smooth'
      });
    }
  };

  return (
    <div className={`relative group/carousel ${className}`}>
      {/* Scroll Buttons (visible on hover on desktop) */}
      {showControls && (
        <>
          <button 
            onClick={() => scroll('left')}
            className="absolute left-0 top-[40%] -translate-y-1/2 -ml-4 z-20 w-10 h-10 rounded-full bg-black/60 border border-[var(--color-border)] text-white flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 disabled:opacity-0 transition-opacity duration-300 hover:bg-black/80 hover:scale-110 focus:outline-none hidden md:flex"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-6 h-6 ml-[-2px]" />
          </button>
          
          <button 
            onClick={() => scroll('right')}
            className="absolute right-0 top-[40%] -translate-y-1/2 -mr-4 z-20 w-10 h-10 rounded-full bg-black/60 border border-[var(--color-border)] text-white flex items-center justify-center opacity-0 group-hover/carousel:opacity-100 disabled:opacity-0 transition-opacity duration-300 hover:bg-black/80 hover:scale-110 focus:outline-none hidden md:flex"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-6 h-6 mr-[-2px]" />
          </button>
        </>
      )}

      {/* Scroll Container */}
      <div 
        ref={scrollContainerRef}
        className="flex overflow-x-auto gap-4 md:gap-6 pb-6 pt-2 px-1 -mx-1 snap-x snap-mandatory hide-horizontal-scrollbar scroll-smooth"
        data-horizontal-scroll="true"
      >
        {React.Children.map(children, (child) => (
          // We wrap each child in a snap container so that each card aligns properly
          <div className="snap-start flex-shrink-0 flex">
            {child}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Carousel;
