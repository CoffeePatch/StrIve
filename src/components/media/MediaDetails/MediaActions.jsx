import React, { useState, useRef, useEffect } from 'react';
import { Play, Eye, Bookmark, ListPlus, Calendar } from 'lucide-react';
import AddToListPopover from '../../lists/AddToListPopover';

const MediaActions = ({
  layoutType = "movie",
  onPlay,
  trailerKey,
  isWatchlisted,
  onToggleWatchlist,
  isWatched,
  onToggleWatched,
  userId,
  mediaItem,
  onCreateNewList
}) => {
  const [showPopover, setShowPopover] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    return () => {
      if (hoverTimeout) clearTimeout(hoverTimeout);
    };
  }, [hoverTimeout]);

  const actionButtonBaseClass =
    "group inline-flex h-11 w-11 items-center overflow-hidden rounded-full px-3 transition-all duration-300 ease-out focus-accent cursor-pointer";

  const actionButtonPrimaryClass =
    `${actionButtonBaseClass} bg-white text-black hover:w-[136px] hover:bg-white hover:px-4`;

  const actionButtonSecondaryClass =
    `${actionButtonBaseClass} bg-white/0 text-white/75 hover:w-[124px] hover:bg-white/10 hover:px-4 hover:text-white`;

  const actionButtonNeutralClass =
    `${actionButtonBaseClass} bg-white/0 text-white/75 hover:w-[136px] hover:bg-white/10 hover:px-4 hover:text-white`;

  const watchlistButtonClass = isWatchlisted
    ? `${actionButtonBaseClass} border border-yellow-400/40 bg-yellow-400/15 text-yellow-200 hover:w-[136px] hover:bg-yellow-400/20 hover:px-4 hover:text-yellow-100`
    : actionButtonNeutralClass;

  const watchedButtonClass = isWatched
    ? `${actionButtonBaseClass} border border-green-400/40 bg-green-400/15 text-green-200 hover:w-[136px] hover:bg-green-400/20 hover:px-4 hover:text-green-100`
    : actionButtonNeutralClass;

  const actionButtonLabelClass =
    "ml-0 max-w-0 overflow-hidden whitespace-nowrap text-sm font-medium opacity-0 transition-all duration-300 ease-out group-hover:ml-2 group-hover:max-w-40 group-hover:opacity-100";

  if (layoutType === "tv") {
    return (
      <div className="flex flex-col gap-3 w-full max-w-[700px]">
        {/* Primary CTA */}
        {onPlay && (
          <button 
            onClick={onPlay} 
            className="w-full h-14 bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-6 flex items-center justify-center gap-2.5 text-white font-semibold hover:bg-[var(--color-accent-primary)] hover:border-transparent focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)] transition-all scale-100 hover:scale-[1.01]"
          >
            <Play className="w-[18px] h-[18px] fill-current" />
            <span>Watch Episodes</span>
          </button>
        )}

        {/* Secondary Actions Row */}
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button
            onClick={onToggleWatched}
            aria-pressed={isWatched}
            className={`flex-1 h-12 rounded-full border flex items-center justify-center gap-2 text-[14px] font-medium transition-colors ${
              isWatched 
                ? 'bg-[#E50914]/20 border-[#E50914]/50 text-[#E50914]' 
                : 'bg-white/10 border-white/10 text-white hover:bg-white/15'
            }`}
          >
            <Eye className="w-4 h-4" fill={isWatched ? "currentColor" : "none"} />
            <span>Watched</span>
          </button>

          <button
            onClick={onToggleWatchlist}
            aria-pressed={isWatchlisted}
            className={`flex-1 h-12 rounded-full border flex items-center justify-center gap-2 text-[14px] font-medium transition-colors ${
              isWatchlisted 
                ? 'bg-[#E50914]/20 border-[#E50914]/50 text-[#E50914]' 
                : 'bg-white/10 border-white/10 text-white hover:bg-white/15'
            }`}
          >
            <Bookmark className="w-4 h-4" fill={isWatchlisted ? "currentColor" : "none"} />
            <span>Watchlist</span>
          </button>

          <div
            ref={popoverRef}
            className="flex-1 relative"
            onMouseEnter={() => {
              if (hoverTimeout) clearTimeout(hoverTimeout);
              const timeout = setTimeout(() => setShowPopover(true), 300);
              setHoverTimeout(timeout);
            }}
            onMouseLeave={() => {
              if (hoverTimeout) clearTimeout(hoverTimeout);
              const timeout = setTimeout(() => setShowPopover(false), 300);
              setHoverTimeout(timeout);
            }}
          >
            <button className="w-full h-12 rounded-full border border-white/10 bg-white/10 text-white hover:bg-white/15 flex items-center justify-center gap-2 text-[14px] font-medium transition-colors">
              <ListPlus className="w-4 h-4" />
              <span>Add to List</span>
            </button>

            {showPopover && (
              <div
                onMouseEnter={() => {
                  if (hoverTimeout) clearTimeout(hoverTimeout);
                }}
                onMouseLeave={() => {
                  if (hoverTimeout) clearTimeout(hoverTimeout);
                  const timeout = setTimeout(() => setShowPopover(false), 300);
                  setHoverTimeout(timeout);
                }}
              >
                <AddToListPopover
                  isOpen={showPopover}
                  onCreateNew={onCreateNewList}
                  userId={userId}
                  mediaItem={mediaItem}
                />
              </div>
            )}
          </div>
        </div>

        {/* Tertiary Action */}
        <button 
          onClick={() => document.getElementById('episodes-section')?.scrollIntoView({ behavior: 'smooth' })}
          className="w-full h-12 rounded-full border border-white/5 bg-white/5 hover:bg-white/10 text-[#E5E7EB] flex items-center justify-center gap-2 text-[14px] transition-colors"
          aria-label="Scroll to episodes section"
        >
          <Calendar className="w-4 h-4" />
          <span>Browse Episodes</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-0 lg:gap-4">
      {/* Primary Actions */}
      {(onPlay || trailerKey) && (
        <div className="flex items-center gap-3 mb-4 lg:mb-0">
          {onPlay && (
            <button onClick={onPlay} className={actionButtonPrimaryClass}>
              <span className="material-symbols-outlined text-xl shrink-0 text-current hidden lg:block">play_circle</span>
              <Play className="w-5 h-5 shrink-0 lg:hidden text-current" />
              <span className={actionButtonLabelClass}>Play Now</span>
            </button>
          )}

          {trailerKey && (
            <a
              href={`https://www.youtube.com/watch?v=${trailerKey}`}
              target="_blank"
              rel="noopener noreferrer"
              className={actionButtonSecondaryClass}
            >
              <span className="material-symbols-outlined text-xl shrink-0 text-current">movie</span>
              <span className={actionButtonLabelClass}>Trailer</span>
            </a>
          )}
        </div>
      )}

      {/* Floating Action Dock (Mobile) / Inline (Desktop) */}
      <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-black/80 backdrop-blur-xl border border-white/10 px-4 py-2.5 rounded-full shadow-2xl lg:relative lg:bottom-auto lg:left-auto lg:translate-x-0 lg:z-auto lg:bg-transparent lg:border-none lg:p-0 lg:shadow-none lg:rounded-none">
        <button
          onClick={onToggleWatchlist}
          className={watchlistButtonClass}
          title="Watchlist"
        >
          <span className={`material-symbols-outlined text-xl shrink-0 transition-colors ${isWatchlisted ? 'text-yellow-200' : 'text-white/75 group-hover:text-white'}`}>
            bookmark
          </span>
          <span className={actionButtonLabelClass}>Watchlist</span>
        </button>

        <button
          onClick={onToggleWatched}
          className={watchedButtonClass}
          title="Watched"
        >
          <span className={`material-symbols-outlined text-xl shrink-0 transition-colors ${isWatched ? 'text-green-200' : 'text-white/75 group-hover:text-white'}`}>
            check_circle
          </span>
          <span className={actionButtonLabelClass}>Watched</span>
        </button>

        <div
          ref={popoverRef}
          className="relative"
          onMouseEnter={() => {
            if (hoverTimeout) clearTimeout(hoverTimeout);
            const timeout = setTimeout(() => setShowPopover(true), 500);
            setHoverTimeout(timeout);
          }}
          onMouseLeave={() => {
            if (hoverTimeout) clearTimeout(hoverTimeout);
            const timeout = setTimeout(() => setShowPopover(false), 300);
            setHoverTimeout(timeout);
          }}
        >
          <button className={actionButtonNeutralClass} title="Add to List">
            <span className="material-symbols-outlined text-xl shrink-0 text-white/75 transition-colors group-hover:text-white">
              playlist_add
            </span>
            <span className={actionButtonLabelClass}>Lists</span>
          </button>

          {showPopover && (
            <div
              onMouseEnter={() => {
                if (hoverTimeout) clearTimeout(hoverTimeout);
              }}
              onMouseLeave={() => {
                if (hoverTimeout) clearTimeout(hoverTimeout);
                const timeout = setTimeout(() => setShowPopover(false), 300);
                setHoverTimeout(timeout);
              }}
            >
              <AddToListPopover
                isOpen={showPopover}
                onCreateNew={onCreateNewList}
                userId={userId}
                mediaItem={mediaItem}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MediaActions;
