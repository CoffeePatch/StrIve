/**
 * IMDb ID Resolver
 * Fetches external IDs from TMDB API and maps them to IMDb IDs
 * Uses existing options pattern from constants.js
 */

import tmdbApiService from '../../services/tmdb/tmdbApiService';

// Constants
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
const CACHE_KEY_PREFIX = 'tmdb_imdb_mapping_';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

/**
 * Generate the cache key for a specific TMDB ID and media type
 * @param {string} tmdbId - The TMDB ID
 * @param {string} mediaType - The media type ('movie' or 'tv')
 * @returns {string} The cache key
 */
function getCacheKey(tmdbId, mediaType) {
  return `${CACHE_KEY_PREFIX}${mediaType}_${tmdbId}`;
}

/**
 * Check if a cache entry is still valid (not expired)
 * @param {Object} cachedItem - The cached item with timestamp
 * @returns {boolean} True if the cache is still valid
 */
function isCacheValid(cachedItem) {
  if (!cachedItem || !cachedItem.timestamp) {
    return false;
  }
  
  return (Date.now() - cachedItem.timestamp) < CACHE_DURATION;
}

/**
 * Sleep function to implement delays
 * @param {number} ms - Number of milliseconds to sleep
 * @returns {Promise} A promise that resolves after the specified time
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Get the IMDb ID for a given TMDB ID and media type
 * @param {string} tmdbId - The TMDB ID
 * @param {string} mediaType - The media type ('movie' or 'tv')
 * @returns {Promise<string|null>} The IMDb ID or null if not found
 */
export const getImdbId = async (tmdbId, mediaType = 'movie') => {
  // Validate inputs
  if (!tmdbId) {
    throw new Error('TMDB ID is required');
  }
  
  if (!['movie', 'tv'].includes(mediaType)) {
    throw new Error('Media type must be either "movie" or "tv"');
  }

  // Check cache first
  const cacheKey = getCacheKey(tmdbId, mediaType);
  const cachedItem = JSON.parse(localStorage.getItem(cacheKey) || 'null');
  
  if (cachedItem && isCacheValid(cachedItem)) {
    console.log(`Cache hit for ${mediaType} ID ${tmdbId}, IMDb ID: ${cachedItem.imdbId}`);
    return cachedItem.imdbId;
  }

  // Not in cache or expired, fetch from TMDB API via proxy
  console.log(`Cache miss for ${mediaType} ID ${tmdbId}, fetching from TMDB API...`);

  let lastError;
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const data = await tmdbApiService.get(`/${mediaType}/${tmdbId}/external_ids`);

      if (!data) {
        throw new Error(`Failed to fetch external IDs`);
      }
      
      // Extract the IMDb ID
      let imdbId = data.imdb_id || null;

      // Fallback: fetch full details with external_ids appended
      if (!imdbId) {
        try {
          const detailsData = await tmdbApiService.get(`/${mediaType}/${tmdbId}`, { append_to_response: 'external_ids' });

          if (detailsData) {
            imdbId = detailsData?.external_ids?.imdb_id || detailsData?.imdb_id || null;
          }
        } catch (detailsError) {
          console.warn(`Fallback details lookup failed for ${mediaType} ${tmdbId}:`, detailsError.message);
        }
      }
      
      // Cache the result (only if we found an ID or it's explicitly null)
      const cacheData = {
        imdbId: imdbId,
        timestamp: Date.now()
      };
      
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      
      if (imdbId) {
        console.log(`Successfully fetched IMDb ID for ${mediaType} ${tmdbId}: ${imdbId}`);
      } else {
        console.log(`No IMDb ID found for ${mediaType} ${tmdbId}`);
      }
      
      return imdbId;
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${attempt} failed for ${mediaType} ${tmdbId}:`, error.message);
      
      // If this is not the last attempt, wait before retrying
      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY * attempt); // Exponential backoff
      }
    }
  }

  // If all retries failed, throw the last error
  console.error(`Failed to get IMDb ID for ${mediaType} ${tmdbId} after ${MAX_RETRIES} attempts`);
  throw new Error(`Failed to get IMDb ID for ${mediaType} ${tmdbId}: ${lastError.message}`);
};

/**
 * Get multiple IMDb IDs for an array of TMDB IDs
 * @param {Array} tmdbIdsArray - Array of objects with {id, type} or just IDs (assuming movie type)
 * @returns {Promise<Object>} Object mapping TMDB IDs to IMDb IDs
 */
export const batchGetImdbIds = async (tmdbIdsArray) => {
  if (!Array.isArray(tmdbIdsArray) || tmdbIdsArray.length === 0) {
    return {};
  }

  const results = {};
  const toFetch = [];

  // Process items that are in cache first
  for (const item of tmdbIdsArray) {
    let tmdbId, mediaType;
    
    // Handle both formats: string ID or object with id and type
    if (typeof item === 'string') {
      tmdbId = item;
      mediaType = 'movie';
    } else if (typeof item === 'object' && item.id) {
      tmdbId = item.id;
      mediaType = item.type || 'movie';
    } else {
      console.warn(`Invalid item in tmdbIdsArray: ${item}`);
      continue;
    }

    // Check cache first
    const cacheKey = getCacheKey(tmdbId, mediaType);
    const cachedItem = JSON.parse(localStorage.getItem(cacheKey) || 'null');
    
    if (cachedItem && isCacheValid(cachedItem)) {
      results[tmdbId] = cachedItem.imdbId;
      console.log(`Cache hit for ${mediaType} ID ${tmdbId}, IMDb ID: ${cachedItem.imdbId}`);
    } else {
      // Mark for fetching
      toFetch.push({ tmdbId, mediaType });
    }
  }

  // Fetch uncached items individually
  // Note: TMDB doesn't have a true batch endpoint for external_ids, so we fetch individually
  for (const { tmdbId, mediaType } of toFetch) {
    try {
      const imdbId = await getImdbId(tmdbId, mediaType);
      results[tmdbId] = imdbId;
    } catch (error) {
      console.error(`Error fetching IMDb ID for ${mediaType} ${tmdbId}:`, error.message);
      results[tmdbId] = null; // Ensure we have an entry even for failures
    }
  }

  return results;
};

/**
 * Clear expired cache entries
 */
export const clearExpiredCache = () => {
  const keysToRemove = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_KEY_PREFIX)) {
      try {
        const cachedItem = JSON.parse(localStorage.getItem(key));
        if (!isCacheValid(cachedItem)) {
          keysToRemove.push(key);
        }
      } catch (error) {  // eslint-disable-line no-unused-vars
        // If we can't parse the cached item, remove it
        keysToRemove.push(key);
      }
    }
  }

  // Remove expired entries
  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
    console.log(`Removed expired cache entry: ${key}`);
  });

  return keysToRemove.length;
};

/**
 * Clear all cache entries for TMDB-IMDb mappings
 */
export const clearAllCache = () => {
  const keysToRemove = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_KEY_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach(key => {
    localStorage.removeItem(key);
  });

  console.log(`Cleared ${keysToRemove.length} cache entries`);
  return keysToRemove.length;
};

/**
 * Get cache statistics
 * @returns {Object} Cache statistics
 */
export const getCacheStatistics = () => {
  let total = 0;
  let valid = 0;
  let expired = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_KEY_PREFIX)) {
      total++;
      try {
        const cachedItem = JSON.parse(localStorage.getItem(key));
        if (isCacheValid(cachedItem)) {
          valid++;
        } else {
          expired++;
        }
      } catch (error) {  // eslint-disable-line no-unused-vars
        expired++; // Treat unparsable items as expired
      }
    }
  }

  return {
    total,
    valid,
    expired,
    hitRate: total > 0 ? ((valid / total) * 100).toFixed(2) : 0
  };
};