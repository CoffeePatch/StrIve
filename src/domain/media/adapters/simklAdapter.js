/**
 * Translates a raw SIMKL API object into the unified Media contract.
 * (Skeleton for future implementation)
 * 
 * @param {Object} data - Raw SIMKL data object
 * @returns {import("../mediaTypes").Media} Normalized Media object
 */
export const simklAdapter = (data) => {
  if (!data) return null;
  
  // Implementation will follow SIMKL data structure
  return {
    id: data.ids?.simkl || data.id,
    source: "simkl",
    title: data.title || "Unknown Title",
    mediaType: data.type === "show" ? "tv" : data.type === "movie" ? "movie" : "unknown",
    rating: {
      score: data.ratings?.simkl?.rating || 0
    },
    posterPath: data.poster ? `https://simkl.in/posters/${data.poster}_m.webp` : "",
    backdropPath: data.fanart ? `https://simkl.in/fanart/${data.fanart}_m.webp` : "",
    releaseYear: data.year?.toString() || "N/A",
    tracking: {
      status: data.status || null,
      nextEpisodeLabel: null // To be implemented
    }
  };
};
