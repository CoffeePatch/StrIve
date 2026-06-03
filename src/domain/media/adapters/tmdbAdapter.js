import { normalizeWatchStatus } from "../../../util/library/watchStatus";

/**
 * Translates a raw TMDB API object (Movie or TV Show) into the unified Media contract.
 * 
 * @param {Object} data - Raw TMDB data object
 * @returns {import("../mediaTypes").Media} Normalized Media object
 */
export const tmdbAdapter = (data) => {
  if (!data) return null;

  // Determine media type
  // Explicitly checking media_type first, fallback to first_air_date presence
  const isTV = data.media_type === "tv" || data.first_air_date !== undefined;
  const mediaType = isTV ? "tv" : "movie";

  // Parse release year
  const releaseDateStr = data.release_date || data.first_air_date || data.releaseDate || "";
  const releaseYear = releaseDateStr ? releaseDateStr.split("-")[0] : "N/A";

  // Normalized tracking logic (especially for TV)
  const normalizedStatus = normalizeWatchStatus(
    data?.tracking?.watchStatus ?? data?.watchStatus ?? data?.status
  );

  let nextEpisodeLabel = null;
  if (isTV) {
    const nextToWatch = data?.tvProgress?.nextToWatch || null;
    const nextSeasonNumber = Number(nextToWatch?.seasonNumber);
    const nextEpisodeNumber = Number(nextToWatch?.episodeNumber);
    const hasNextEpisode = Number.isInteger(nextSeasonNumber) && Number.isInteger(nextEpisodeNumber);
    
    const shouldDefaultNext = !hasNextEpisode && 
      (normalizedStatus === "plan_to_watch" || normalizedStatus === "watching" || !normalizedStatus);
    
    if (hasNextEpisode) {
      nextEpisodeLabel = `S${nextSeasonNumber}E${nextEpisodeNumber}`;
    } else if (shouldDefaultNext) {
      nextEpisodeLabel = "S1E1";
    }
  }

  // Handle poster paths correctly (absolute or relative)
  let finalPosterPath = data.poster_path || "";
  if (finalPosterPath && !finalPosterPath.startsWith("http")) {
    finalPosterPath = `https://image.tmdb.org/t/p/w500${finalPosterPath}`;
  }

  let finalBackdropPath = data.backdrop_path || "";
  if (finalBackdropPath && !finalBackdropPath.startsWith("http")) {
    finalBackdropPath = `https://image.tmdb.org/t/p/w1280${finalBackdropPath}`;
  }

  return {
    id: data.id,
    source: "tmdb",
    title: data.title || data.name || "Unknown Title",
    mediaType,
    rating: {
      score: data.vote_average || 0,
      imdbScore: Number(data?.ratings?.imdbScore) || undefined,
      imdbVotes: Number(data?.ratings?.imdbVotes) || undefined
    },
    posterPath: finalPosterPath,
    backdropPath: finalBackdropPath,
    releaseYear,
    tracking: {
      status: normalizedStatus,
      nextEpisodeLabel
    }
  };
};
