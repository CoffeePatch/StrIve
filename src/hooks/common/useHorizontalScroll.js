import { useEffect } from 'react';

/**
 * Custom hook to enable horizontal scrolling with mouse wheel
 * @param {React.RefObject} ref - Ref to the scrollable container
 */
const useHorizontalScroll = (ref) => {
  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    const handleWheel = (e) => {
      // Only handle horizontal scroll if there's overflow
      if (container.scrollWidth > container.clientWidth) {
        e.preventDefault();
        // Use deltaY (vertical wheel) for horizontal scroll
        container.scrollLeft += e.deltaY;
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [ref]);
};

export default useHorizontalScroll;
