import { resolveMetadataSnapshot } from './metadataEnrichmentCoordinator';

/**
 * Fetches IMDB rating, votes, and poster image for a media item
 * Ensures numbers are returned (never strings, never "0")
 * 
 * @param {string} tmdbId - The TMDB ID
 * @param {string} mediaType - The media type ('movie' or 'tv')
 * @returns {Promise<Object>} Object with imdbId, imdbRating, imdbVotes, imdbPoster
 */
export const fetchImdbData = async (tmdbId, mediaType) => {
  try {
    const titleData = await resolveMetadataSnapshot({
      tmdbId: String(tmdbId),
      mediaType,
      forceRefresh: false,
    });

    return {
      imdbId: titleData?.imdbId || null,
      imdbRating: titleData?.imdbRating ?? null,
      imdbVotes: titleData?.imdbVotes ?? null,
      imdbPoster: titleData?.imdbPoster ?? null,
    };
  } catch (error) {
    console.warn(`Failed to fetch IMDB data for TMDB ${tmdbId}: ${error.message}`);
    return { imdbId: null, imdbRating: null, imdbVotes: null, imdbPoster: null };
  }
};


