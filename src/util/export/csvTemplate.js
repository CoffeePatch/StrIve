/**
 * CSV Template Generator
 * Provides a downloadable template CSV with correct headers and example data
 */

const EXPECTED_HEADERS = ['tmdbId','imdbId','name','year','mediaType','tmdbRating','imdbRating','tmdbVotes','imdbVotes'];

const EXAMPLE_ROW = {
  tmdbId: '603',
  imdbId: 'tt0133093',
  name: 'The Matrix',
  year: '1999',
  mediaType: 'movie',
  tmdbRating: '8.2',
  imdbRating: '8.7',
  tmdbVotes: '2000000',
  imdbVotes: '1900000'
};

/**
 * Generates and downloads a template CSV file
 */
export function downloadTemplateCsv() {
  // Build CSV content
  const header = EXPECTED_HEADERS.join(',');
  const exampleRow = EXPECTED_HEADERS.map(key => EXAMPLE_ROW[key] || '').join(',');
  const csvContent = `${header}\n${exampleRow}`;

  // Create blob and download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'strive-import-template.csv';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  // Clean up
  window.URL.revokeObjectURL(url);
}

/**
 * Returns the expected headers for validation
 */
export function getExpectedHeaders() {
  return [...EXPECTED_HEADERS];
}
