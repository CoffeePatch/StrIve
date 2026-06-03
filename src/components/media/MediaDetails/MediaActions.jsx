import React, { useState, useRef, useEffect } from 'react';
import { Play } from 'lucide-react';
import AddToListPopover from '../../lists/AddToListPopover';

const MediaActions = ({
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

  return (
    <div className="flex flex-wrap items-center gap-3 lg:gap-4">
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

      <div className="flex items-center gap-2">
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
