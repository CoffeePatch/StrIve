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
    <div className={`relative group/carousel -mx-4 sm:-mx-8 lg:-mx-12 ${className}`}>
      {/* Scroll Buttons (visible on hover on desktop) */}
      {showControls && (
        <>
          {/* Left Overlay */}
          <div className="absolute left-0 top-2 bottom-6 w-16 z-20 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300 hidden md:flex items-center justify-center bg-gradient-to-r from-[#0f1014] via-[#0f1014]/80 to-transparent pointer-events-none rounded-l-xl -ml-1">
            <button 
              onClick={() => scroll('left')}
              className="w-full h-full flex items-center justify-center text-white/80 hover:text-white hover:scale-125 transition-all duration-300 focus:outline-none pointer-events-auto"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-10 h-10" />
            </button>
          </div>
          
          {/* Right Overlay */}
          <div className="absolute right-0 top-2 bottom-6 w-16 z-20 opacity-0 group-hover/carousel:opacity-100 transition-opacity duration-300 hidden md:flex items-center justify-center bg-gradient-to-l from-[#0f1014] via-[#0f1014]/80 to-transparent pointer-events-none rounded-r-xl -mr-1">
            <button 
              onClick={() => scroll('right')}
              className="w-full h-full flex items-center justify-center text-white/80 hover:text-white hover:scale-125 transition-all duration-300 focus:outline-none pointer-events-auto"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-10 h-10" />
            </button>
          </div>
        </>
      )}

      {/* Scroll Container */}
      <div 
        ref={scrollContainerRef}
        className="flex overflow-x-auto gap-4 md:gap-6 pb-6 pt-2 px-4 sm:px-8 lg:px-12 snap-x snap-mandatory hide-horizontal-scrollbar scroll-smooth disable-mouse-scroll"
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
