import React from "react";
import { Check, CheckCircle2 } from "lucide-react";

const MobileEpisodeRow = ({ episode, onClick, isWatched = false, onToggleWatched, watchLoading = false }) => {
  const handleWatchedClick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    if (onToggleWatched && !watchLoading) {
      onToggleWatched(episode);
    }
  };

  const seasonNumber = String(episode.seasonNumber || episode.season_number || 1).padStart(2, "0");
  const episodeNumber = String(episode.episodeNumber || episode.episode_number || 1).padStart(2, "0");
  const episodeCode = `S${seasonNumber}E${episodeNumber}`;

  return (
    <div
      onClick={onClick}
      className="flex items-center justify-between p-4 bg-white/[0.04] rounded-xl min-h-[72px] mb-2 cursor-pointer transition-colors hover:bg-white/[0.06]"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={`Play ${episode.name}, Episode ${episodeNumber}`}
    >
      {/* Left side: Title + Meta */}
      <div className="flex-1 min-w-0 pr-4">
        <h3 className="text-[15px] font-semibold text-white truncate mb-1">
          {episode.name}
        </h3>
        <div className="flex items-center gap-1.5 text-[13px] text-[#9CA3AF] font-normal">
          <span>{episodeCode}</span>
          {episode.airDate && (
            <>
              <span>•</span>
              <span>
                {new Date(episode.airDate).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Right side: Watched Toggle */}
      <button
        onClick={handleWatchedClick}
        disabled={watchLoading}
        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
          isWatched
            ? "bg-green-500/20 text-green-400 ring-1 ring-green-500/30"
            : "text-[#9CA3AF] hover:bg-white/10 hover:text-white"
        }`}
        aria-label={isWatched ? `Mark ${episode.name} as unwatched` : `Mark ${episode.name} as watched`}
        title={isWatched ? "Watched" : "Mark as watched"}
      >
        {isWatched ? (
          <Check className="w-5 h-5" strokeWidth={3} />
        ) : (
          <CheckCircle2 className="w-6 h-6" />
        )}
      </button>
    </div>
  );
};

export default MobileEpisodeRow;
