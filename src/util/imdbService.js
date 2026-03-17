/**
 * IMDb Service
 * Handles all API calls to IMDb data provider
 * Requires VITE_IMDB_BASE_URL environment variable
 */
class IMDbService {
  constructor() {
    const configuredBaseUrl = import.meta.env.VITE_IMDB_BASE_URL?.trim();
    const fallbackBaseUrl = 'https://api.imdbapi.dev';
    const isPlaceholder = configuredBaseUrl && configuredBaseUrl.startsWith('your_');

    if (!configuredBaseUrl || isPlaceholder) {
      console.warn('VITE_IMDB_BASE_URL not set. Falling back to https://api.imdbapi.dev.');
    }

    const selectedBaseUrl = (!configuredBaseUrl || isPlaceholder)
      ? fallbackBaseUrl
      : configuredBaseUrl;

    this.baseUrl = selectedBaseUrl.replace(/\/$/, '');
    this.fallbackBaseUrl = fallbackBaseUrl;
  }

  async requestJson(path) {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    const candidateBaseUrls = [this.baseUrl];

    if (this.fallbackBaseUrl && this.fallbackBaseUrl !== this.baseUrl) {
      candidateBaseUrls.push(this.fallbackBaseUrl);
    }

    let lastError;

    for (const baseUrl of candidateBaseUrls) {
      try {
        const response = await fetch(`${baseUrl}${normalizedPath}`);

        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        lastError = error;
        console.error(`IMDb request failed for ${baseUrl}${normalizedPath}:`, error);
      }
    }

    throw lastError || new Error('IMDb request failed');
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