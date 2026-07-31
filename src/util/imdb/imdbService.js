/**
 * IMDb Service
 * Handles all API calls to IMDb data provider
 * Requires VITE_IMDB_BASE_URL environment variable
 */
class IMDbService {
  constructor() {
    const configuredBaseUrl = import.meta.env.VITE_IMDB_BASE_URL?.trim();

    if (!configuredBaseUrl) {
      console.warn('VITE_IMDB_BASE_URL environment variable is not configured.');
    }

    this.baseUrl = configuredBaseUrl ? configuredBaseUrl.replace(/\/$/, '') : '';
  }

  async requestJson(path) {
    if (!this.baseUrl) {
      throw new Error('IMDb API base URL is not configured');
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const response = await fetch(`${this.baseUrl}${normalizedPath}`);

    if (!response.ok) {
      const httpError = new Error(`HTTP error! Status: ${response.status}`);
      httpError.status = response.status;
      throw httpError;
    }

    return await response.json();
  }

  /**
   * Fetches title information by IMDb ID
   * @param {string} imdbId - The IMDb ID to lookup
   * @returns {Promise<Object>} The title data from IMDb API
   */
  async getTitleById(imdbId) {
    try {
      return await this.requestJson(`/titles/${imdbId}`);
    } catch (error) {
      console.error(`Error fetching data for IMDb ID ${imdbId}:`, error);
      throw error;
    }
  }

  /**
   * Searches for titles based on a query string
   * @param {string} query - The search query
   * @returns {Promise<Array>} The array of title data from IMDb API
   */
  async searchTitles(query, limit = 50) {
    try {
      const encodedQuery = encodeURIComponent(query);
      const data = await this.requestJson(`/search/titles?query=${encodedQuery}&limit=${limit}`);
      return data.titles || [];
    } catch (error) {
      console.error(`Error searching for titles with query "${query}":`, error);
      throw error;
    }
  }
}

export default IMDbService;