import { getImdbId } from '../util/imdb/imdbResolver';
import IMDbService from '../util/imdb/imdbService';
import { firstNumber } from '../util/firebase/firestoreService';

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
    const imdbService = new IMDbService();
    const imdbId = await getImdbId(tmdbId, mediaType);

    if (!imdbId) {
      console.debug(`No IMDb ID found for TMDB ID: ${tmdbId}`);
      return { imdbId: null, imdbRating: null, imdbVotes: null, imdbPoster: null };
    }

    const titleData = await imdbService.getTitleById(imdbId);

    // Extract and validate rating
    const imdbRating = firstNumber(
      titleData?.rating?.aggregateRating,
      titleData?.rating?.ratingValue,
      titleData?.aggregateRating,
      titleData?.imdbRating
    );

    // Ensure rating is a valid number (not NaN or 0)
    const validRating = (imdbRating && !isNaN(imdbRating) && imdbRating > 0)
      ? imdbRating
      : null;

    // Extract and validate votes
    const imdbVotes = firstNumber(
      titleData?.rating?.voteCount,
      titleData?.rating?.ratingCount,
      titleData?.voteCount,
      titleData?.imdbVotes
    );

    // Ensure votes is a valid number (not NaN or 0)
    const validVotes = (imdbVotes && !isNaN(imdbVotes) && imdbVotes > 0)
      ? imdbVotes
      : null;

    // Extract IMDb poster image
    const imdbPoster = titleData?.primaryImage?.url || null;

    return {
      imdbId: imdbId || null,
      imdbRating: validRating,
      imdbVotes: validVotes,
      imdbPoster: imdbPoster,
    };
  } catch (error) {
    console.warn(`Failed to fetch IMDB data for TMDB ${tmdbId}: ${error.message}`);
    return { imdbId: null, imdbRating: null, imdbVotes: null, imdbPoster: null };
  }
};


