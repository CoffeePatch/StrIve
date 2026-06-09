import { useState, useEffect, useCallback, useMemo } from 'react';

/**
 * useGridVirtualization
 * Custom hook to virtualize a responsive CSS Grid layout using window scroll.
 * Uses spacer-padding to keep the layout simple, light, and 100% Tailwind-compatible.
 */
export function useGridVirtualization({
  items = [],
  viewMode,
  isMobileView = false,
  gapSize = 24,
  defaultCardHeight = 330,
  bufferRows = 3
}) {
  const [containerNode, setContainerNode] = useState(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerWidth, setContainerWidth] = useState(window.innerWidth);
  const [measuredRowHeight, setMeasuredRowHeight] = useState(null);

  // Callback ref to reliably observe the container element when it mounts
  const containerRef = useCallback((node) => {
    setContainerNode(node);
  }, []);

  // 1. Sync window scroll position
  useEffect(() => {
    const handleScroll = () => {
      setScrollTop(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // initial sync
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 2. Sync container width on resize
  useEffect(() => {
    if (!containerNode) return;
    
    setContainerWidth(containerNode.getBoundingClientRect().width || window.innerWidth);

    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    
    observer.observe(containerNode);
    return () => observer.disconnect();
  }, [containerNode]);

  // 3. Determine column count dynamically matching Tailwind responsive breakpoints
  const columnCount = useMemo(() => {
    const width = containerWidth;
    if (isMobileView) {
      if (width < 768) return 3;
      if (width < 1024) return 4;
      return 5;
    }
    if (viewMode === 'wide' || viewMode === 'bookshelf') {
      if (width < 768) return 1;
      if (width < 1280) return 2;
      return 3;
    } else {
      if (width < 640) return 2;
      if (width < 768) return 3;
      if (width < 1024) return 4;
      if (width < 1280) return 5;
      return 6;
    }
  }, [containerWidth, viewMode, isMobileView]);

  // 4. Resolve row height: use measured if available, else default
  const rowHeight = useMemo(() => {
    if (measuredRowHeight) return measuredRowHeight;
    if (viewMode === 'wide' || viewMode === 'bookshelf') {
      return 134 + gapSize;
    }
    return defaultCardHeight + gapSize;
  }, [measuredRowHeight, viewMode, gapSize, defaultCardHeight]);

  // 5. Measure card element height from DOM to adjust rowHeight
  useEffect(() => {
    if (!containerNode) return;
    
    const measure = () => {
      const children = Array.from(containerNode.children);
      const cardChild = children.find(child => child.getAttribute('data-card-item') === 'true');
      if (cardChild) {
        const height = cardChild.getBoundingClientRect().height;
        if (height > 0) {
          setMeasuredRowHeight(height + gapSize);
        }
      }
    };

    // Run next frame to ensure rendering is complete
    const rId = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(rId);
  }, [containerNode, items, columnCount, viewMode, gapSize]);

  // 6. Reset measured height on viewMode changes
  useEffect(() => {
    setMeasuredRowHeight(null);
  }, [viewMode]);

  // 7. Calculate visible range and spacing paddings
  const { visibleItems, topPadding, bottomPadding } = useMemo(() => {
    if (!items || !items.length) {
      return { visibleItems: [], topPadding: 0, bottomPadding: 0 };
    }

    // Absolute vertical offset relative to the page
    const containerOffsetTop = containerNode
      ? containerNode.getBoundingClientRect().top + window.scrollY
      : 100;

    const viewportHeight = window.innerHeight;
    const totalItems = items.length;
    const totalRows = Math.ceil(totalItems / columnCount);

    const relativeScrollTop = Math.max(0, scrollTop - containerOffsetTop);
    
    let startRow = Math.floor(relativeScrollTop / rowHeight) - bufferRows;
    startRow = Math.max(0, startRow);

    let endRow = Math.ceil((relativeScrollTop + viewportHeight) / rowHeight) + bufferRows;
    endRow = Math.min(totalRows - 1, endRow);

    const startIndex = startRow * columnCount;
    const endIndex = Math.min(totalItems, (endRow + 1) * columnCount);

    const visibleItems = items.slice(startIndex, endIndex);
    const topPadding = startRow * rowHeight;
    const bottomPadding = Math.max(0, (totalRows - startRow - (endRow - startRow + 1)) * rowHeight);

    return {
      visibleItems,
      topPadding,
      bottomPadding
    };
  }, [items, scrollTop, columnCount, rowHeight, bufferRows, containerNode]);

  return {
    containerRef,
    visibleItems,
    topPadding,
    bottomPadding,
    columnCount
  };
}
