// src/util/core/riveService.js
export class RiveStreamingService {
  static BASE_URL = "https://rivestream.org/embed";

  /**
   * Get streaming URL for a movie using TMDB ID
   * @param {number} tmdbId - The Movie Database ID
   * @returns {string} - Rive embed URL for the movie
   */
  static getMovieStreamUrl(tmdbId) {
    return `https://rivestream.org/embed?type=movie&id=${tmdbId}`;
  }

  /**
   * Get streaming URL for a TV show episode using TMDB ID
   * @param {number} tmdbId - The Movie Database ID
   * @param {number} season - Season number
   * @param {number} episode - Episode number
   * @returns {string} - Rive embed URL for the TV episode
   */
  static getTVStreamUrl(tmdbId, season, episode) {
    return `https://rivestream.org/embed?type=tv&id=${tmdbId}&season=${season}&episode=${episode}`;
  }

  /**
   * Check if content is available on Rive
   * @returns {Promise<boolean>} - Whether content is available
   */
  static async isContentAvailable() {
    // For iframe embeds, we can't reliably check with HEAD request
    // So we'll assume it's available and handle errors in the player
    return true;
  }

  /**
   * Get alternative streaming URLs for fallback
   * @param {number} tmdbId - TMDB ID
   * @returns {Array<object>} - Array of server objects with names and URLs
   */
  static getAlternativeServers(tmdbId) {
    const servers = [];
    
    // Always include RiveStream as it doesn't require environment variables
    servers.push({
      name: "RiveStream",
      url: `https://rivestream.org/embed?type=movie&id=${tmdbId}`,
    });
    
    // Add other services only if their environment variables are defined
    if (import.meta.env.VITE_CINEMAOS_URL) {
      servers.push({
        name: "Cinemaos",
        url: `${import.meta.env.VITE_CINEMAOS_URL}/${tmdbId}`,
      });
    }
    
    if (import.meta.env.VITE_2EMBED_URL) {
      servers.push({
        name: "2Embed",
        url: `${import.meta.env.VITE_2EMBED_URL}/movie?id=${tmdbId}`,
      });
    }
    
    if (import.meta.env.VITE_MULTIEMBED_URL) {
      servers.push({
        name: "MultiEmbed",
        url: `${import.meta.env.VITE_MULTIEMBED_URL}/directstream.php?video_id=${tmdbId}&tmdb=1`,
      });
    }
    
    if (import.meta.env.VITE_VIDSRC_URL) {
      servers.push({
        name: "VidSrc",
        url: `${import.meta.env.VITE_VIDSRC_URL}/movie?tmdb=${tmdbId}`,
      });
    }
    
    return servers;
  }
}