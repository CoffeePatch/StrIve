import { unparse } from 'papaparse';

/**
 * Safely extracts year from a date string
 * @param {string} dateString - Date string in format YYYY-MM-DD
 * @returns {string} 4-digit year or empty string
 */
const extractYear = (dateString) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? '' : date.getFullYear().toString();
  } catch (error) {
    return '';
  }
};

/**
 * Safely formats rating to one decimal place
 * @param {number|string} rating - Rating value
 * @returns {string} Formatted rating or empty string
 */
const formatRating = (rating) => {
  if (rating === null || rating === undefined || rating === '') return '';
  const num = parseFloat(rating);
  return isNaN(num) ? '' : num.toFixed(1);
};

/**
 * Safely escapes and formats text fields for CSV
 * @param {string|number} text - Text to format
 * @returns {string} Formatted text
 */
const formatText = (text) => {
  if (text === null || text === undefined) return '';
  return text.toString().trim();
};

/**
 * Maps a single list's items to CSV format with proper edge case handling
 * @param {Object} list - A single list object with name and items
 * @returns {string} CSV formatted string
 */
export const mapSingleListToCsv = (list) => {
  // Validate input
  if (!list || typeof list !== 'object') {
    console.error('Invalid list object provided to mapSingleListToCsv');
    return 'List Name,Title,Year,Type,TMDB Rating,IMDB Rating,TMDB Votes,IMDB Votes,Date Added,TMDB ID,IMDB ID\n';
  }

  // Prepare CSV data array
  const csvData = [];
  
  // Add headers
  csvData.push(['List Name', 'Title', 'Year', 'Type', 'TMDB Rating', 'IMDB Rating', 'TMDB Votes', 'IMDB Votes', 'Date Added', 'TMDB ID', 'IMDB ID']);
  
  // Process list items with proper edge case handling
  if (list.items && Array.isArray(list.items) && list.items.length > 0) {
    list.items.forEach(item => {
      // Skip invalid items
      if (!item || typeof item !== 'object') {
        console.warn('Skipping invalid item in list:', list.name);
        return;
      }

      // Create CSV row for each item with safe formatting
      csvData.push([
        formatText(list.name || 'Unnamed List'),           // List Name
        formatText(item.title || item.name || 'Unknown'),   // Title
        extractYear(item.release_date),                     // Year
        formatText(item.media_type || 'movie'),            // Type
        formatRating(item.vote_average),                    // TMDB Rating
        formatRating(item.imdbRating),                      // IMDB Rating
        formatText(item.vote_count || ''),                  // TMDB Votes
        formatText(item.imdbVotes || ''),                   // IMDB Votes
        formatText(item.dateAdded || ''),                   // Date Added
        formatText(item.id || ''),                          // TMDB ID
        formatText(item.imdbId || '')                       // IMDB ID
      ]);
    });
  }

  // Convert to CSV string using papaparse
  return unparse(csvData, {
    header: false, // We're providing headers as the first row
    skipEmptyLines: true
  });
};

/**
 * Maps multiple lists to CSV format with proper edge case handling
 * @param {Array} lists - Array of list objects from Redux store
 * @returns {string} CSV formatted string
 */
export const mapListsToCsv = (lists) => {
  // Validate input
  if (!Array.isArray(lists)) {
    console.error('Invalid lists array provided to mapListsToCsv');
    return 'List Name,Title,Year,Type,TMDB Rating,IMDB Rating,TMDB Votes,IMDB Votes,Date Added,TMDB ID,IMDB ID\n';
  }

  // Prepare CSV data array
  const csvData = [];
  
  // Add headers
  csvData.push(['List Name', 'Title', 'Year', 'Type', 'TMDB Rating', 'IMDB Rating', 'TMDB Votes', 'IMDB Votes', 'Date Added', 'TMDB ID', 'IMDB ID']);
  
  // Process each list and its items with proper edge case handling
  lists.forEach(list => {
    // Skip invalid lists
    if (!list || typeof list !== 'object') {
      console.warn('Skipping invalid list');
      return;
    }

    // Skip lists without items or with invalid items array
    if (!list.items || !Array.isArray(list.items)) {
      console.warn(`List "${list.name || 'Unnamed List'}" has no valid items array`);
      return;
    }

    // Process list items
    list.items.forEach(item => {
      // Skip invalid items
      if (!item || typeof item !== 'object') {
        console.warn('Skipping invalid item in list:', list.name);
        return;
      }

      // Create CSV row for each item with safe formatting
      csvData.push([
        formatText(list.name || 'Unnamed List'),           // List Name
        formatText(item.title || item.name || 'Unknown'),   // Title
        extractYear(item.release_date),                     // Year
        formatText(item.media_type || 'movie'),            // Type
        formatRating(item.vote_average),                    // TMDB Rating
        formatRating(item.imdbRating),                      // IMDB Rating
        formatText(item.vote_count || ''),                  // TMDB Votes
        formatText(item.imdbVotes || ''),                   // IMDB Votes
        formatText(item.dateAdded || ''),                   // Date Added
        formatText(item.id || ''),                          // TMDB ID
        formatText(item.imdbId || '')                       // IMDB ID
      ]);
    });
  });

  console.log(`Generated ${csvData.length - 1} CSV rows (excluding header)`);
  
  // Convert to CSV string using papaparse
  return unparse(csvData, {
    header: false, // We're providing headers as the first row
    skipEmptyLines: true
  });
};

/**
 * Generates CSV blob for download (single list) with proper error handling
 * @param {Object} list - A single list object from Redux store
 * @returns {Blob} CSV blob
 */
export const generateSingleListCsvBlob = (list) => {
  try {
    const csvString = mapSingleListToCsv(list);
    return new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  } catch (error) {
    console.error('Error generating single list CSV blob:', error);
    throw new Error('Failed to generate CSV export');
  }
};

/**
 * Generates CSV blob for download (multiple lists) with proper error handling
 * @param {Array} lists - Array of list objects from Redux store
 * @returns {Blob} CSV blob
 */
export const generateCsvBlob = (lists) => {
  try {
    const csvString = mapListsToCsv(lists);
    return new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  } catch (error) {
    console.error('Error generating CSV blob:', error);
    throw new Error('Failed to generate CSV export');
  }
};