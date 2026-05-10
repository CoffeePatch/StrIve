/**
 * IMDb API Service
 * Interact with api.imdbapi.dev to fetch movie/show details
 * Based on IMDB.md Swagger definition
 */

const API_BASE_URL = "https://api.imdbapi.dev";

class ImdbApiService {
  /**
   * Get details for a single title
   * @param {string} titleId - IMDb ID (e.g., tt1234567)
   * @returns {Promise<Object>} Title details
   */
  async getTitle(titleId) {
    try {
      const response = await fetch(`${API_BASE_URL}/titles/${titleId}`);
      if (!response.ok) {
        throw new Error(`IMDb API Error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Failed to fetch IMDb title ${titleId}:`, error);
      return null;
    }
  }

  /**
   * Get details for multiple titles (Batch)
   * @param {Array<string>} titleIds - List of IMDb IDs (Max 5)
   * @returns {Promise<Object>} Object containing list of titles
   */
  async getTitlesBatch(titleIds) {
    if (!titleIds || titleIds.length === 0) return { titles: [] };
    if (titleIds.length > 5) {
      console.warn(
        "getTitlesBatch called with more than 5 IDs. Truncating to 5."
      );
      titleIds = titleIds.slice(0, 5);
    }

    try {
      const params = new URLSearchParams();
      titleIds.forEach((id) => params.append("titleIds", id));

      const response = await fetch(
        `${API_BASE_URL}/titles:batchGet?${params.toString()}`
      );
      if (!response.ok) {
        throw new Error(`IMDb API Batch Error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error("Failed to fetch IMDb batch:", error);
      return { titles: [] };
    }
  }
  /**
   * Extract relevant data for enrichment
   * @param {Object} imdbData Raw IMDb response
   */
  extractEnrichmentData(imdbData) {
    if (!imdbData) return null;

    return {
      imdb_rating: imdbData.rating?.aggregateRating,
      imdb_vote_count: imdbData.rating?.voteCount,
      // We can extract more if needed, but TMDB is primary for other data
    };
  }
}

export default new ImdbApiService();
