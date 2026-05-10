/**
 * SIMKL API Service
 * Handles all SIMKL API communication for sync, scrobbling, and data management
 */

import simklAuthService from './simklAuthService';

const API_BASE_URL = 'https://api.simkl.com';

class SimklApiService {
  constructor() {
    this.clientId = import.meta.env.VITE_SIMKL_CLIENT_ID;
  }

  /**
   * Get headers for API requests
   */
  getHeaders(includeAuth = true) {
    const headers = {
      'Content-Type': 'application/json',
      'simkl-api-key': this.clientId,
    };

    if (includeAuth) {
      const token = simklAuthService.getAccessToken();
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    return headers;
  }

  /**
   * Generic API request handler
   */
  async request(endpoint, options = {}) {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: this.getHeaders(options.requireAuth !== false),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.message || `API request failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error(`SIMKL API Error (${endpoint}):`, error);
      throw error;
    }
  }

  /**
   * Get user's activities to check for changes
   * Returns timestamps for different data types to enable smart sync
   */
  async getActivities() {
    return this.request('/sync/activities', {
      method: 'POST',
    });
  }

  /**
   * Get all synced items (movies, shows, anime)
   * Supports delta sync using date_from parameter
   * @param {string} dateFrom - ISO date string for delta sync (optional)
   */
  async getAllItems(dateFrom = null) {
    const params = new URLSearchParams({
      extended: 'full',
    });

    if (dateFrom) {
      params.append('date_from', dateFrom);
    }

    return this.request(`/sync/all-items/?${params.toString()}`, {
      method: 'GET',
    });
  }

  /**
   * Get user settings and profile information
   */
  async getUserSettings() {
    return this.request('/users/settings', {
      method: 'GET',
    });
  }

  /**
   * Push watch history to SIMKL
   * @param {Array} items - Array of items to mark as watched
   * Format: { movies: [...], shows: [...], episodes: [...] }
   */
  async pushHistory(items) {
    return this.request('/sync/history', {
      method: 'POST',
      body: JSON.stringify(items),
    });
  }

  /**
   * Remove items from watch history
   * @param {Object} items - Items to remove
   */
  async removeHistory(items) {
    return this.request('/sync/history/remove', {
      method: 'POST',
      body: JSON.stringify(items),
    });
  }

  /**
   * Add items to watchlist
   * @param {Object} items - Items to add
   */
  async addToWatchlist(items) {
    return this.request('/sync/add-to-list', {
      method: 'POST',
      body: JSON.stringify(items),
    });
  }

  /**
   * Remove items from watchlist
   * @param {Object} items - Items to remove
   */
  async removeFromWatchlist(items) {
    return this.request('/sync/remove-from-list', {
      method: 'POST',
      body: JSON.stringify(items),
    });
  }

  /**
   * Add ratings for items
   * @param {Object} items - Items with ratings
   */
  async addRatings(items) {
    return this.request('/sync/ratings', {
      method: 'POST',
      body: JSON.stringify(items),
    });
  }

  /**
   * Scrobble - Start watching
   * @param {Object} mediaInfo - Media information
   * Format: { movie: {...} } or { show: {...}, episode: {...} }
   */
  async scrobbleStart(mediaInfo) {
    return this.request('/scrobble/start', {
      method: 'POST',
      body: JSON.stringify(mediaInfo),
    });
  }

  /**
   * Scrobble - Pause watching
   * @param {Object} mediaInfo - Media information
   */
  async scrobblePause(mediaInfo) {
    return this.request('/scrobble/pause', {
      method: 'POST',
      body: JSON.stringify(mediaInfo),
    });
  }

  /**
   * Scrobble - Stop watching
   * @param {Object} mediaInfo - Media information with progress
   * If progress > 80%, SIMKL automatically marks as completed
   */
  async scrobbleStop(mediaInfo) {
    return this.request('/scrobble/stop', {
      method: 'POST',
      body: JSON.stringify(mediaInfo),
    });
  }

  /**
   * Get last scrobbled activity
   */
  async getLastActivity() {
    return this.request('/sync/activities', {
      method: 'POST',
    });
  }

  /**
   * Search for shows/movies
   * @param {string} query - Search query
   * @param {string} type - Type filter (movie, show, anime)
   */
  async search(query, type = null) {
    const params = new URLSearchParams({ q: query });
    if (type) params.append('type', type);

    return this.request(`/search/${type || 'all'}?${params.toString()}`, {
      method: 'GET',
      requireAuth: false,
    });
  }

  /**
   * Get user statistics
   */
  async getUserStats() {
    return this.request('/users/stats', {
      method: 'GET',
    });
  }

  /**
   * Sync watchlist (get current state)
   */
  async getWatchlist() {
    return this.request('/sync/all-items/watchlist', {
      method: 'GET',
    });
  }

  /**
   * Get watched history
   */
  async getHistory() {
    return this.request('/sync/all-items/watched', {
      method: 'GET',
    });
  }
}

export default new SimklApiService();
