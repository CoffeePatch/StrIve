import React from "react";

export const MediaProgress = ({ media, vaultMode = false }) => {
  const nextEpisodeLabel = media?.tracking?.nextEpisodeLabel;

  if (!nextEpisodeLabel) return null;

  if (vaultMode) {
    return (
      <div className="absolute bottom-2 left-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
        <div className="bg-black/75 border border-white/10 rounded px-2 py-1 text-[11px] text-white/90">
          Next: {nextEpisodeLabel}
        </div>
      </div>
    );
  }

  // Not typically shown in default card mode, but we can add support later if needed
  return null;
};
