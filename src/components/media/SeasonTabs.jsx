import React, { useRef, useEffect } from "react";

const SeasonTabs = ({ totalSeasons, selectedSeason, onSeasonChange }) => {
  const tablistRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!tablistRef.current) return;
      
      const tabs = Array.from(tablistRef.current.querySelectorAll('[role="tab"]'));
      const currentIndex = tabs.findIndex(tab => tab.getAttribute('aria-selected') === 'true');
      
      let newIndex = currentIndex;
      
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        newIndex = currentIndex + 1 < tabs.length ? currentIndex + 1 : 0;
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        newIndex = currentIndex - 1 >= 0 ? currentIndex - 1 : tabs.length - 1;
      } else if (e.key === 'Home') {
        e.preventDefault();
        newIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        newIndex = tabs.length - 1;
      }
      
      if (newIndex !== currentIndex) {
        tabs[newIndex]?.focus();
        tabs[newIndex]?.click();
      }
    };
    
    const tablist = tablistRef.current;
    tablist?.addEventListener('keydown', handleKeyDown);
    
    return () => {
      tablist?.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedSeason]);

  const seasons = Array.from({ length: totalSeasons }, (_, i) => i + 1);

  return (
    <div>
      <div
        ref={tablistRef}
        role="tablist"
        aria-label="Season selection"
        data-horizontal-scroll="true"
        className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide"
      >
        {seasons.map((seasonNum) => (
          <button
            key={seasonNum}
            role="tab"
            aria-selected={selectedSeason === seasonNum}
            aria-controls={`season-${seasonNum}-panel`}
            id={`season-${seasonNum}-tab`}
            tabIndex={selectedSeason === seasonNum ? 0 : -1}
            onClick={() => onSeasonChange(seasonNum)}
            className="flex-shrink-0 px-6 py-3 rounded-full font-medium transition-all focus-accent cursor-pointer"
            style={{
              backgroundColor: selectedSeason === seasonNum 
                ? 'var(--color-accent-primary)' 
                : 'var(--color-bg-elevated)',
              color: selectedSeason === seasonNum 
                ? '#000' 
                : 'var(--color-text-secondary)',
            }}
          >
            Season {seasonNum}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SeasonTabs;
