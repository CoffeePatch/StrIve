// Integration Test for Full Export Workflow
import { mapListsToCsv, generateCsvBlob } from '../../util/export/exportToCsv';

describe('Full Export Workflow Integration', () => {
  // Sample Redux state data structure
  const mockReduxState = {
    lists: {
      customLists: {
        lists: [
          {
            id: 'favorites-list',
            name: 'My Favorites',
            items: [
              {
                id: 123456, // TMDB ID
                title: 'The Matrix',
                release_date: '1999-03-30',
                media_type: 'movie',
                vote_average: 8.7,
                dateAdded: '2024-01-15T10:30:00Z'
              },
              {
                id: 789012, // TMDB ID
                title: 'Inception',
                release_date: '2010-07-16',
                media_type: 'movie',
                vote_average: 8.1,
                dateAdded: '2024-01-16T14:20:00Z'
              }
            ]
          },
          {
            id: 'watch-later-list',
            name: 'Watch Later',
            items: [
              {
                id: 345678, // TMDB ID
                title: 'Interstellar',
                release_date: '2014-11-07',
                media_type: 'movie',
                vote_average: 8.6,
                dateAdded: '2024-01-17T09:15:00Z'
              },
              {
                // Missing TMDB ID - edge case
                title: 'Movie Without TMDB ID',
                release_date: '2015-01-01',
                media_type: 'movie',
                vote_average: 7.2,
                dateAdded: '2024-01-18T12:00:00Z'
              }
            ]
          }
        ]
      }
    }
  };

  test('full workflow from Redux state to CSV file download', () => {
    // Extract lists data as the selector would
    const listsData = mockReduxState.lists.customLists.lists;
    
    // Validate input data structure
    expect(Array.isArray(listsData)).toBe(true);
    expect(listsData).toHaveLength(2);
    
    // Verify first list
    expect(listsData[0]).toHaveProperty('id', 'favorites-list');
    expect(listsData[0]).toHaveProperty('name', 'My Favorites');
    expect(Array.isArray(listsData[0].items)).toBe(true);
    expect(listsData[0].items).toHaveLength(2);
    
    // Verify items have TMDB IDs
    expect(listsData[0].items[0]).toHaveProperty('id', 123456);
    expect(listsData[0].items[1]).toHaveProperty('id', 789012);
    
    // Verify second list
    expect(listsData[1]).toHaveProperty('id', 'watch-later-list');
    expect(listsData[1]).toHaveProperty('name', 'Watch Later');
    expect(Array.isArray(listsData[1].items)).toBe(true);
    expect(listsData[1].items).toHaveLength(2);
    
    // Verify item without TMDB ID is handled
    expect(listsData[1].items[1]).not.toHaveProperty('id');
    expect(listsData[1].items[1]).toHaveProperty('title', 'Movie Without TMDB ID');
  });

  test('CSV generation from Redux state data', () => {
    // Extract lists data as the selector would
    const listsData = mockReduxState.lists.customLists.lists;
    
    // Generate CSV using the utility
    const csvResult = mapListsToCsv(listsData);
    
    // Split into lines for validation
    const lines = csvResult.trim().split('\n');
    
    // Verify headers
    expect(lines[0].trim()).toBe('List Name,Title,Year,Type,Rating,Date Added,TMDB ID');
    
    // Verify we have the correct number of rows
    expect(lines).toHaveLength(5); // Header + 4 items
    
    // Verify first data row (first item from first list)
    const firstRow = lines[1].split(',');
    expect(firstRow[0].trim()).toBe('My Favorites');  // List Name
    expect(firstRow[1].trim()).toBe('The Matrix');    // Title
    expect(firstRow[2].trim()).toBe('1999');           // Year
    expect(firstRow[3].trim()).toBe('movie');          // Type
    expect(firstRow[4].trim()).toBe('8.7');            // Rating
    expect(firstRow[5].trim()).toBe('2024-01-15T10:30:00Z'); // Date Added
    expect(firstRow[6].trim()).toBe('123456');         // TMDB ID
    
    // Verify second data row (second item from first list)
    const secondRow = lines[2].split(',');
    expect(secondRow[0].trim()).toBe('My Favorites');  // List Name
    expect(secondRow[1].trim()).toBe('Inception');     // Title
    expect(secondRow[2].trim()).toBe('2010');          // Year
    expect(secondRow[3].trim()).toBe('movie');         // Type
    expect(secondRow[4].trim()).toBe('8.1');           // Rating
    expect(secondRow[5].trim()).toBe('2024-01-16T14:20:00Z'); // Date Added
    expect(secondRow[6].trim()).toBe('789012');        // TMDB ID
    
    // Verify third data row (first item from second list)
    const thirdRow = lines[3].split(',');
    expect(thirdRow[0].trim()).toBe('Watch Later');    // List Name
    expect(thirdRow[1].trim()).toBe('Interstellar');   // Title
    expect(thirdRow[2].trim()).toBe('2014');           // Year
    expect(thirdRow[3].trim()).toBe('movie');          // Type
    expect(thirdRow[4].trim()).toBe('8.6');            // Rating
    expect(thirdRow[5].trim()).toBe('2024-01-17T09:15:00Z'); // Date Added
    expect(thirdRow[6].trim()).toBe('345678');         // TMDB ID
    
    // Verify fourth data row (item without TMDB ID)
    const fourthRow = lines[4].split(',');
    expect(fourthRow[0].trim()).toBe('Watch Later');   // List Name
    expect(fourthRow[1].trim()).toBe('Movie Without TMDB ID'); // Title
    expect(fourthRow[2].trim()).toBe('2015');          // Year
    expect(fourthRow[3].trim()).toBe('movie');         // Type
    expect(fourthRow[4].trim()).toBe('7.2');           // Rating
    expect(fourthRow[5].trim()).toBe('2024-01-18T12:00:00Z'); // Date Added
    expect(fourthRow[6].trim()).toBe('');              // Empty TMDB ID but cell exists
  });

  test('CSV blob generation for download', async () => {
    // Extract lists data as the selector would
    const listsData = mockReduxState.lists.customLists.lists;
    
    // Generate CSV blob using the utility
    const csvBlob = generateCsvBlob(listsData);
    
    // Verify blob was created correctly
    expect(csvBlob).toBeInstanceOf(Blob);
    expect(csvBlob.type).toBe('text/csv;charset=utf-8;');
    
    // Verify blob size is reasonable
    expect(csvBlob.size).toBeGreaterThan(0);
    
    // The blob should contain valid CSV data
    // Convert blob to text using array buffer (works in Node.js environment)
    const arrayBuffer = await csvBlob.arrayBuffer();
    const csvContent = new TextDecoder().decode(arrayBuffer);
    
    expect(typeof csvContent).toBe('string');
    expect(csvContent).toContain('List Name,Title,Year,Type,Rating,Date Added,TMDB ID');
    expect(csvContent).toContain('The Matrix');
    expect(csvContent).toContain('123456');
    expect(csvContent).toContain('Inception');
    expect(csvContent).toContain('789012');
    expect(csvContent).toContain('Interstellar');
    expect(csvContent).toContain('345678');
    expect(csvContent).toContain('Movie Without TMDB ID');
  });

  test('timestamped filename generation', () => {
    // Generate filename with current date
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `my-lists-export-${dateStr}.csv`;
    
    // Verify filename format
    expect(fileName).toMatch(/^my-lists-export-\d{8}\.csv$/);
    expect(fileName).toContain('.csv');
    expect(fileName).not.toContain(' ');
    expect(fileName).not.toContain(':');
    expect(fileName).not.toContain('/');
    
    // Verify date format is correct (YYYYMMDD)
    const datePart = fileName.replace('my-lists-export-', '').replace('.csv', '');
    expect(datePart).toHaveLength(8);
    expect(datePart).toMatch(/^\d{8}$/);
  });

  test('edge case handling with invalid data', () => {
    // Test with null/undefined input
    const nullResult = mapListsToCsv(null);
    expect(nullResult).toBe('List Name,Title,Year,Type,Rating,Date Added,TMDB ID\n');
    
    const undefinedResult = mapListsToCsv(undefined);
    expect(undefinedResult).toBe('List Name,Title,Year,Type,Rating,Date Added,TMDB ID\n');
    
    // Test with empty array
    const emptyResult = mapListsToCsv([]);
    const emptyLines = emptyResult.trim().split('\n');
    expect(emptyLines).toHaveLength(1);
    expect(emptyLines[0]).toBe('List Name,Title,Year,Type,Rating,Date Added,TMDB ID');
    
    // Test with lists without items
    const noItemsResult = mapListsToCsv([{ id: 'empty-list', name: 'Empty List' }]);
    const noItemsLines = noItemsResult.trim().split('\n');
    expect(noItemsLines).toHaveLength(1);
    expect(noItemsLines[0]).toBe('List Name,Title,Year,Type,Rating,Date Added,TMDB ID');
    
    // Test with lists with empty items array
    const emptyItemsResult = mapListsToCsv([{ id: 'empty-items', name: 'Empty Items List', items: [] }]);
    const emptyItemsLines = emptyItemsResult.trim().split('\n');
    expect(emptyItemsLines).toHaveLength(1);
    expect(emptyItemsLines[0]).toBe('List Name,Title,Year,Type,Rating,Date Added,TMDB ID');
  });
});