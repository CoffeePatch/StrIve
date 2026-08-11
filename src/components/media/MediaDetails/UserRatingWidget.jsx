import React, { useState, useRef, useEffect } from "react";
import { Star, X } from "lucide-react";

const RATING_OPTIONS = [
  1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 
  5.5, 6.0, 6.5, 7.0, 7.5, 8.0, 8.5, 9.0, 9.5, 10.0
];

const UserRatingWidget = ({ userRating = null, onRatingChange, readOnly = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectRating = (score) => {
    if (onRatingChange) {
      onRatingChange(score);
    }
    setIsOpen(false);
  };

  const currentScore = typeof userRating === "number" && userRating > 0 ? userRating.toFixed(1) : null;

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        disabled={readOnly}
        onClick={() => !readOnly && setIsOpen(!isOpen)}
        className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 border transition-all duration-200 text-xs font-bold shadow-md ${
          currentScore
            ? "bg-amber-500/20 border-amber-500/60 text-amber-400 hover:bg-amber-500/30"
            : "bg-surface/80 backdrop-blur-md border-white/10 text-muted hover:text-primary hover:border-white/20"
        }`}
        title={currentScore ? `Your rating: ${currentScore}/10` : "Click to rate"}
      >
        <Star className={`w-3.5 h-3.5 ${currentScore ? "fill-amber-400 text-amber-400" : "text-muted"}`} />
        <span>{currentScore ? `${currentScore}/10` : "Rate"}</span>
      </button>

      {isOpen && !readOnly && (
        <div className="absolute left-0 mt-2 w-64 p-3 bg-[#18181b]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/10">
            <span className="text-xs font-semibold text-primary">Your Rating</span>
            {currentScore && (
              <button
                type="button"
                onClick={() => handleSelectRating(null)}
                className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 font-medium transition-colors"
              >
                <X className="w-3 h-3" /> Clear
              </button>
            )}
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {RATING_OPTIONS.map((score) => {
              const isSelected = Number(currentScore) === score;
              return (
                <button
                  key={score}
                  type="button"
                  onClick={() => handleSelectRating(score)}
                  className={`py-1 rounded text-xs font-bold transition-all ${
                    isSelected
                      ? "bg-amber-500 text-black shadow-md scale-105"
                      : "bg-white/5 text-secondary hover:bg-amber-500/20 hover:text-amber-400"
                  }`}
                >
                  {score.toFixed(1)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default UserRatingWidget;
