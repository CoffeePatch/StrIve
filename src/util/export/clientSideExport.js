/**
 * Client-side CSV export (fallback when Functions aren't available)
 * Exports list data directly from Firestore without server processing
 */

import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/firebase';
import IMDbService from '../imdb/imdbService';
import { getImdbId } from '../imdb/imdbResolver';

// Helper to fetch IMDb rating and votes
async function fetchImdbRatingData(imdbId) {
  if (!imdbId) return { rating: '', votes: '' };
  
  try {
    const imdbService = new IMDbService();
    const titleData = await imdbService.getTitleById(imdbId);
    
    return {
      rating: titleData?.rating?.aggregateRating || '',
      votes: titleData?.rating?.voteCount || ''
    };
  } catch (error) {
    console.warn(`Failed to fetch IMDb rating for ${imdbId}:`, error.message);
    return { rating: '', votes: '' };
  }
}

// Helper to limit concurrent requests
function pLimit(concurrency) {
  let activeCount = 0;
  const queue = [];
  
  const next = () => {
    activeCount--;
    if (queue.length > 0) {
      queue.shift()();
    }
  };
  
  const run = async (fn) => {
    if (activeCount >= concurrency) {
      await new Promise(resolve => queue.push(resolve));
    }
    activeCount++;
    try {
      return await fn();
    } finally {
      next();
    }
  };
  
  return run;
}

/**
 * Export list data to CSV on the client side
 * @param {string} listId - List ID or 'watchlist'
 * @param {string} listName - Display name for the list
 * @param {string} userId - Current user ID
 */
export async function exportListClientSide(listId, listName, userId) {
  try {
    // Fetch items from Firestore
    let itemsRef;
    
    if (listId === 'watchlist') {
      itemsRef = collection(db, 'users', userId, 'watchlist');
    } else {
      itemsRef = collection(db, 'users', userId, 'custom_lists', listId, 'items');
    }
    
    const snapshot = await getDocs(itemsRef);
    
    if (snapshot.empty) {
      return { success: false, message: 'No items to export', isEmpty: true };
    }
    
    // Extract items
    const items = [];
    snapshot.forEach(doc => {
      items.push(doc.data());
    });
    
    console.log('📊 CSV Export Debug - Sample item:', items[0]);
    console.log('   vote_count field:', items[0]?.vote_count);
    console.log('   vote_average field:', items[0]?.vote_average);
    
    // Fetch IMDb IDs and ratings concurrently with rate limiting
    const limit = pLimit(5); // Limit to 5 concurrent requests
    const enrichedItems = await Promise.all(
      items.map(item => limit(async () => {
        const tmdbId = item.id || item.tmdbId || '';
        const mediaType = item.media_type || 'movie';
        
        // Try to get stored IMDb data first
        let imdbId = item.imdb_id || item.imdbId || '';
        let imdbRating = item.imdbRating || '';
        let imdbVotes = item.imdbVotes || '';
        
        // If no IMDb ID is stored, try to fetch it
        if (!imdbId && tmdbId) {
          imdbId = await getImdbId(tmdbId, mediaType);
        }
        
        // If we have IMDb ID but no rating, fetch it
        if (imdbId && !imdbRating) {
          const ratingData = await fetchImdbRatingData(imdbId);
          imdbRating = ratingData.rating;
          imdbVotes = ratingData.votes;
        }
        
        return {
          tmdbId,
          imdbId,
          name: item.title || item.name || '',
          year: extractYear(item.release_date || item.first_air_date || ''),
          mediaType,
          tmdbRating: item.vote_average ? String(item.vote_average) : '',
          imdbRating,
          tmdbVotes: item.vote_count ? String(item.vote_count) : '',
          imdbVotes
        };
      }))
    );
    
    // Build CSV
    const headers = ['tmdbId', 'imdbId', 'name', 'year', 'mediaType', 'tmdbRating', 'imdbRating', 'tmdbVotes', 'imdbVotes'];
    const rows = enrichedItems.map(item => [
      escapeCsvField(String(item.tmdbId)),
      escapeCsvField(item.imdbId),
      escapeCsvField(item.name),
      escapeCsvField(item.year),
      escapeCsvField(item.mediaType),
      escapeCsvField(item.tmdbRating),
      escapeCsvField(item.imdbRating),
      escapeCsvField(item.tmdbVotes),
      escapeCsvField(item.imdbVotes)
    ].join(','));
    
    // Build CSV content
    const csvContent = [headers.join(','), ...rows].join('\n');
    
    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    // Generate filename
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    const dateStr = `${y}${m}${d}`;
    const safeName = (listId === 'watchlist' ? 'Watchlist' : (listName || 'List')).replace(/[\n\r]/g, ' ').trim();
    link.download = `${safeName}-${dateStr}.csv`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    
    return { success: true, count: rows.length };
    
  } catch (error) {
    console.error('Client-side export error:', error);
    return { success: false, message: error.message };
  }
}

/**
 * Escape CSV field if it contains special characters
 */
function escapeCsvField(field) {
  if (field === null || field === undefined) {
    return '';
  }
  const fieldStr = String(field);
  if (fieldStr.includes(',') || fieldStr.includes('"') || fieldStr.includes('\n')) {
    return `"${fieldStr.replace(/"/g, '""')}"`;
  }
  return fieldStr;
}

/**
 * Extract year from date string (YYYY-MM-DD)
 */
function extractYear(dateStr) {
  if (!dateStr) return '';
  const match = dateStr.match(/^(\d{4})/);
  return match ? match[1] : '';
}
