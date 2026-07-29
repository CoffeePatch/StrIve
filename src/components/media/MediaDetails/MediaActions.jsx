import React, { useState, useRef, useEffect } from 'react';
import { Play, Eye, Bookmark, ListPlus, Calendar, Lock, Edit2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AddToListPopover from '../../lists/AddToListPopover';
import WatchDateModal from './WatchDateModal';

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
  onCreateNewList,
  trackingData
}) => {
  const [showPopover, setShowPopover] = useState(false);
  const [showWatchDateModal, setShowWatchDateModal] = useState(false);
  const [showMobileWatchMenu, setShowMobileWatchMenu] = useState(false);
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
    <div className="flex flex-col gap-3 w-full max-w-[700px]">
      {/* Primary CTA */}
      {layoutType === "tv" && onPlay && (
          <button 
            aria-disabled="true"
            onClick={(e) => e.preventDefault()}
            title="Streaming feature coming soon"
            className="w-full h-14 bg-white/5 border border-white/10 rounded-full px-6 flex items-center justify-center gap-2.5 text-white/50 font-semibold cursor-not-allowed opacity-70 transition-all"
          >
            <Lock className="w-[18px] h-[18px]" />
            <span>Watch Episodes</span>
          </button>
      )}

      {layoutType === "movie" && onPlay && (
        <button 
          aria-disabled="true"
          onClick={(e) => e.preventDefault()}
          title="Streaming feature coming soon"
          className="w-full h-14 bg-white/5 border border-white/10 rounded-full px-6 flex items-center justify-center gap-2.5 text-white/50 font-semibold cursor-not-allowed opacity-70 transition-all"
        >
          <Lock className="w-[18px] h-[18px]" />
          <span>Play Now</span>
        </button>
      )}

      {/* Secondary Actions Row (Tablet/Desktop) */}
      <div className="hidden md:flex flex-col sm:flex-row gap-3 w-full">
          <div className={`flex-1 h-12 rounded-full border flex items-center transition-colors ${
              isWatched 
                ? 'bg-accent/20 border-accent/50' 
                : 'bg-white/10 border-white/10 hover:bg-white/15'
            }`}>
            <button
              onClick={() => onToggleWatched()}
              aria-pressed={isWatched}
              className={`flex-1 h-full flex items-center justify-center gap-2 text-[14px] font-medium rounded-l-full ${
                isWatched ? 'text-accent' : 'text-white'
              }`}
            >
              <Eye className="w-4 h-4" fill={isWatched ? "currentColor" : "none"} />
              <span>Watched</span>
            </button>
            <div className={`w-[1px] h-6 ${isWatched ? 'bg-accent/20' : 'bg-white/10'}`}></div>
            <button
              onClick={() => setShowWatchDateModal(true)}
              title={isWatched ? "Edit watch date" : "Set custom watch date"}
              className={`w-12 h-full flex items-center justify-center rounded-r-full hover:bg-white/10 ${
                isWatched ? 'text-accent' : 'text-white/60 hover:text-white'
              }`}
            >
              {isWatched ? <Edit2 className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
            </button>
          </div>

          <button
            onClick={onToggleWatchlist}
            aria-pressed={isWatchlisted}
            className={`flex-1 h-12 rounded-full border flex items-center justify-center gap-2 text-[14px] font-medium transition-colors ${
              isWatchlisted 
                ? 'bg-accent/20 border-accent/50 text-accent' 
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
      {layoutType === "tv" && (
        <button 
          onClick={() => document.getElementById('episodes-section')?.scrollIntoView({ behavior: 'smooth' })}
          className="w-full h-12 rounded-full border border-white/5 bg-white/5 hover:bg-white/10 text-[#E5E7EB] flex items-center justify-center gap-2 text-[14px] transition-colors"
          aria-label="Scroll to episodes section"
        >
          <Calendar className="w-4 h-4" />
          <span>Browse Episodes</span>
        </button>
      )}

      {layoutType === "movie" && trailerKey && (
        <a
          href={`https://www.youtube.com/watch?v=${trailerKey}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full h-12 rounded-full border border-white/5 bg-white/5 hover:bg-white/10 text-[#E5E7EB] flex items-center justify-center gap-2 text-[14px] transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">movie</span>
          <span>Watch Trailer</span>
        </a>
      )}

      {/* Floating Action Dock (Mobile Only) */}
        <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 z-50 md:hidden flex items-center gap-4 bg-black/85 backdrop-blur-xl border border-white/10 px-5 py-3 rounded-full shadow-2xl max-w-[calc(100vw-32px)]">
          <button
            onClick={() => setShowMobileWatchMenu(true)}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${isWatched ? 'text-accent bg-white/5' : 'text-white hover:bg-white/10'}`}
            title="Watch Options"
            aria-pressed={isWatched}
            aria-label="Toggle Watched Options"
          >
            <Eye className="w-5 h-5" fill={isWatched ? "currentColor" : "none"} />
          </button>

          <button
            onClick={onToggleWatchlist}
            className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors ${isWatchlisted ? 'text-accent bg-white/5' : 'text-white hover:bg-white/10'}`}
            title="Watchlist"
            aria-pressed={isWatchlisted}
            aria-label="Toggle Watchlist"
          >
            <Bookmark className="w-5 h-5" fill={isWatchlisted ? "currentColor" : "none"} />
          </button>

          <div ref={popoverRef} className="relative">
            <button
              onClick={() => setShowPopover(!showPopover)}
              className={`w-10 h-10 flex items-center justify-center rounded-full transition-colors text-white hover:bg-white/10`}
              title="Add to List"
              aria-label="Add to List"
            >
              <ListPlus className="w-5 h-5" />
            </button>

            {showPopover && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max">
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

      {/* Mobile Watch Options Bottom Sheet */}
      <AnimatePresence>
        {showMobileWatchMenu && (
          <div className="fixed inset-0 z-[100] flex items-end md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMobileWatchMenu(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full bg-[#1A1C20] rounded-t-3xl overflow-hidden z-10 border border-white/10 flex flex-col pb-6 shadow-2xl"
            >
              <div className="w-full flex justify-center pt-3 pb-2">
                <div className="w-12 h-1.5 bg-white/20 rounded-full" />
              </div>
              <div className="px-6 py-2 pb-4">
                <h2 className="text-lg font-bold text-white mb-4">Watch Options</h2>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={() => {
                      setShowMobileWatchMenu(false);
                      onToggleWatched();
                    }}
                    className="w-full h-14 rounded-xl flex items-center gap-3 px-4 bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-colors"
                  >
                    <Eye className="w-5 h-5" fill={isWatched ? "currentColor" : "none"} />
                    <span>{isWatched ? 'Unwatch' : 'Mark watched now'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowMobileWatchMenu(false);
                      setShowWatchDateModal(true);
                    }}
                    className="w-full h-14 rounded-xl flex items-center gap-3 px-4 bg-white/5 border border-white/10 text-white font-medium hover:bg-white/10 transition-colors"
                  >
                    {isWatched ? <Edit2 className="w-5 h-5" /> : <Calendar className="w-5 h-5" />}
                    <span>{isWatched ? 'Edit watch date' : 'Choose watch date'}</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <WatchDateModal 
        isOpen={showWatchDateModal}
        onClose={() => setShowWatchDateModal(false)}
        initialDate={trackingData?.lastWatchedAt || trackingData?.addedAt}
        titleReleaseDate={mediaItem?.release_date || mediaItem?.first_air_date}
        onSave={(date) => {
          onToggleWatched({ watchedAt: date });
        }}
      />
    </div>
  );
};

export default MediaActions;
