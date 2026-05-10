// Data Access & Validation Test
import { mapListsToCsv, mapSingleListToCsv } from '../util/export/exportToCsv';

describe('Data Access & Validation', () => {
  // Test data that matches the actual Redux state structure
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
                title: 'Some Movie Without ID',
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

  test('accesses full Redux state snapshot correctly', () => {
    // Extract lists data as the selector would
    const listsData = mockReduxState.lists.customLists.lists;
    
    // Verify we have the right structure
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
    expect(listsData[1].items[1]).toHaveProperty('title', 'Some Movie Without ID');
  });

  test('validates structure and content including optional TMDB IDs', () => {
    const listsData = mockReduxState.lists.customLists.lists;
    
    // Generate CSV to verify data mapping
    const csvResult = mapListsToCsv(listsData);
    const lines = csvResult.trim().split('\n');
    
    // Verify headers (account for Windows line endings)
    expect(lines[0].trim()).toBe('List Name,Title,Year,Type,Rating,Date Added,TMDB ID');
    
    // Verify we have all rows (header + 4 items, but one missing TMDB ID)
    expect(lines).toHaveLength(5);
    
    // Verify first data row (has TMDB ID)
    const firstRow = lines[1].split(',');
    expect(firstRow[0].trim()).toBe('My Favorites');  // List Name
    expect(firstRow[1].trim()).toBe('The Matrix');    // Title
    expect(firstRow[2].trim()).toBe('1999');           // Year
    expect(firstRow[3].trim()).toBe('movie');          // Type
    expect(firstRow[4].trim()).toBe('8.7');            // Rating
    expect(firstRow[5].trim()).toBe('2024-01-15T10:30:00Z'); // Date Added
    expect(firstRow[6].trim()).toBe('123456');         // TMDB ID - present!
    
    // Verify fourth data row (missing TMDB ID)
    const fourthRow = lines[4].split(',');
    expect(fourthRow[0].trim()).toBe('Watch Later');   // List Name
    expect(fourthRow[1].trim()).toBe('Some Movie Without ID'); // Title
    expect(fourthRow[2].trim()).toBe('2015');          // Year
    expect(fourthRow[3].trim()).toBe('movie');          // Type
    expect(fourthRow[4].trim()).toBe('7.2');            // Rating
    expect(fourthRow[5].trim()).toBe('2024-01-18T12:00:00Z'); // Date Added
    expect(fourthRow[6].trim()).toBe('');              // TMDB ID - empty but present!
  });

  test('handles edge cases with missing data gracefully', () => {
    // Test with missing/invalid data
    const edgeCaseLists = [
      {
        id: 'edge-case-list',
        name: 'Edge Cases',
        items: [
          {
            // Missing almost everything except title
            title: 'Minimal Movie'
          },
          {
            // Missing TMDB ID but has other data
            title: 'No ID Movie',
            release_date: '2020-05-15',
            media_type: 'tv', // TV show type
            vote_average: 9.0,
            dateAdded: '2024-01-20T08:00:00Z'
          },
          null, // Invalid item
          undefined, // Invalid item
          'invalid-item' // Invalid item
        ]
      }
    ];
    
    const csvResult = mapListsToCsv(edgeCaseLists);
    const lines = csvResult.trim().split('\n');
    
    // Should still have header and 2 valid rows (skipping invalid items)
    expect(lines).toHaveLength(3);
    expect(lines[0].trim()).toBe('List Name,Title,Year,Type,Rating,Date Added,TMDB ID');
    
    // First valid item
    const firstRow = lines[1].split(',');
    expect(firstRow[0].trim()).toBe('Edge Cases');
    expect(firstRow[1].trim()).toBe('Minimal Movie');
    expect(firstRow[2].trim()).toBe(''); // No release date
    expect(firstRow[3].trim()).toBe('movie'); // Default type
    expect(firstRow[4].trim()).toBe(''); // No rating
    expect(firstRow[5].trim()).toBe(''); // No date added
    expect(firstRow[6].trim()).toBe(''); // No TMDB ID
    
    // Second valid item
    const secondRow = lines[2].split(',');
    expect(secondRow[0].trim()).toBe('Edge Cases');
    expect(secondRow[1].trim()).toBe('No ID Movie');
    expect(secondRow[2].trim()).toBe('2020'); // Extracted year
    expect(secondRow[3].trim()).toBe('tv'); // TV type preserved
    expect(secondRow[4].trim()).toBe('9.0'); // Rating preserved
    expect(secondRow[5].trim()).toBe('2024-01-20T08:00:00Z'); // Date added preserved
    expect(secondRow[6].trim()).toBe(''); // No TMDB ID but cell exists
  });
});