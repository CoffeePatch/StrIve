/**
 * TMDB API Service
 * Interact with TMDb API via proxy to fetch movie/show details
 */

const PROXY_URL = "/api/tmdb";

class TmdbApiService {
  constructor() {
    // No longer need client-side API key check
  }

  async _fetch(endpoint, params = {}) {
    const url = new URL(PROXY_URL, window.location.origin);
    url.searchParams.append("endpoint", endpoint);
    Object.keys(params).forEach((key) =>
      url.searchParams.append(key, params[key])
    );

    try {
      const response = await fetch(url.toString());
      if (!response.ok) {
        if (response.status === 429) {
          console.warn("TMDB Rate Limit Exceeded. Backing off.");
        }
        throw new Error(`Proxy API Error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`Failed to fetch from proxy (${endpoint}):`, error);
      return null;
    }
  }

  /**
   * Generic GET query to TMDB via proxy
   * @param {string} endpoint
   * @param {Object} params
   */
  async get(endpoint, params = {}) {
    return this._fetch(endpoint, params);
  }

  /**
   * Get details for a movie
   * @param {string|number} tmdbId
   * @returns {Promise<Object>} Movie details with credits
   */
  async getMovieDetails(tmdbId) {
    return this._fetch(`/movie/${tmdbId}`, {
      append_to_response: "credits,images,videos",
      include_image_language: "en,null",
    });
  }

  /**
   * Get details for a TV show
   * @param {string|number} tmdbId
   * @returns {Promise<Object>} Show details with credits
   */
  async getShowDetails(tmdbId) {
    return this._fetch(`/tv/${tmdbId}`, {
      append_to_response: "credits,images,videos",
      include_image_language: "en,null",
    });
  }

  /**
   * Get details based on media type
   * @param {string} type 'movie' or 'tv' (or 'show')
   * @param {string|number} tmdbId
   */
  async getDetails(type, tmdbId) {
    if (type === "movie") {
      return this.getMovieDetails(tmdbId);
    } else if (type === "show" || type === "tv" || type === "anime") {
      // Anime is usually treated as TV in TMDB
      return this.getShowDetails(tmdbId);
    }
    return null;
  }

  /**
   * Extract relevant data for enrichment
   * @param {Object} tmdbData Raw TMDB response
   */
  extractEnrichmentData(tmdbData) {
    if (!tmdbData) return null;

    return {
      poster_path: tmdbData.poster_path,
      backdrop_path: tmdbData.backdrop_path,
      overview: tmdbData.overview,
      vote_average: tmdbData.vote_average,
      vote_count: tmdbData.vote_count,
      runtime:
        tmdbData.runtime ||
        (tmdbData.episode_run_time ? tmdbData.episode_run_time[0] : null),
      status: tmdbData.status,
      tagline: tmdbData.tagline,
    };
  }

  /**
   * Find content by external ID (IMDb, TVDB, etc.)
   * @param {string} externalId - The external ID (e.g., 'tt3581920')
   * @param {string} source - The source ('imdb_id', 'tvdb_id', 'freebase_id', etc.)
   * @returns {Promise<Object>} Results with movie_results and tv_results arrays
   */
  async findByExternalId(externalId, source = "imdb_id") {
    return this._fetch(`/find/${externalId}`, {
      external_source: source,
    });
  }

  /**
   * Get TMDB ID from IMDb ID
   * @param {string} imdbId - IMDb ID (e.g., 'tt3581920')
   * @param {string} mediaType - 'movie' or 'tv' (optional, returns both if not specified)
   * @returns {Promise<number|null>} TMDB ID or null
   */
  async getTmdbIdFromImdb(imdbId, mediaType = null) {
    try {
      const results = await this.findByExternalId(imdbId, "imdb_id");
      
      if (mediaType === "movie" && results.movie_results?.length > 0) {
        return results.movie_results[0].id;
      } else if (mediaType === "tv" && results.tv_results?.length > 0) {
        return results.tv_results[0].id;
      } else {
        // Return first result if no media type specified
        if (results.movie_results?.length > 0) {
          return results.movie_results[0].id;
        } else if (results.tv_results?.length > 0) {
          return results.tv_results[0].id;
        }
      }
      
      return null;
    } catch (error) {
      console.error(`Failed to get TMDB ID for IMDb ${imdbId}:`, error);
      return null;
    }
  }
}

export default new TmdbApiService();
