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
      {totalSeasons > 10 && (
        <div className="md:hidden mb-4">
          <select
            value={selectedSeason}
            onChange={(e) => onSeasonChange(Number(e.target.value))}
            className="w-full p-3 rounded-lg border border-border bg-surface text-primary focus-accent cursor-pointer appearance-none"
            aria-label="Select Season"
          >
            {seasons.map((seasonNum) => (
              <option key={seasonNum} value={seasonNum}>
                Season {seasonNum}
              </option>
            ))}
          </select>
        </div>
      )}

      <div
        ref={tablistRef}
        role="tablist"
        aria-label="Season selection"
        data-horizontal-scroll="true"
        className={`gap-2 overflow-x-auto pb-2 scrollbar-hide ${totalSeasons > 10 ? 'hidden md:flex' : 'flex'}`}
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
            className={`flex-shrink-0 px-6 py-3 rounded-full font-medium transition-all focus-accent cursor-pointer ${
              selectedSeason === seasonNum
                ? 'bg-accent text-inverse'
                : 'bg-surface text-secondary hover:text-primary hover:bg-surface-hover'
            }`}
          >
            Season {seasonNum}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SeasonTabs;
