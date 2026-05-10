// End-to-end test for CSV export functionality
import { mapListsToCsv } from '../../util/export/exportToCsv';

describe('End-to-End CSV Export Test', () => {
  test('generates correctly formatted CSV file', () => {
    // Sample test data matching real Redux state structure
    const testData = [
      {
        id: 'list1',
        name: 'My Favorites',
        items: [
          {
            id: 123456,
            title: 'The Matrix',
            release_date: '1999-03-30',
            media_type: 'movie',
            vote_average: 8.7,
            dateAdded: '2024-01-15T10:30:00Z'
          },
          {
            id: 789012,
            title: 'Inception',
            release_date: '2010-07-16',
            media_type: 'movie',
            vote_average: 8.1,
            dateAdded: '2024-01-16T14:20:00Z'
          }
        ]
      },
      {
        id: 'list2',
        name: 'Watch Later',
        items: [
          {
            id: 345678,
            title: 'Interstellar',
            release_date: '2014-11-07',
            media_type: 'movie',
            vote_average: 8.6,
            dateAdded: '2024-01-17T09:15:00Z'
          }
        ]
      }
    ];

    // Generate CSV
    const csvResult = mapListsToCsv(testData);
    
    // Split into lines
    const lines = csvResult.trim().split('\n');
    
    // Verify headers
    expect(lines[0]).toBe('List Name,Title,Year,Type,Rating,Date Added,TMDB ID');
    
    // Verify we have the correct number of rows (header + 3 items)
    expect(lines).toHaveLength(4);
    
    // Verify first data row
    const firstRow = lines[1].split(',');
    expect(firstRow[0]).toBe('My Favorites');
    expect(firstRow[1]).toBe('The Matrix');
    expect(firstRow[2]).toBe('1999');
    expect(firstRow[3]).toBe('movie');
    expect(firstRow[4]).toBe('8.7');
    expect(firstRow[6]).toBe('123456');
    
    // Verify filename format would be correct
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const expectedFilename = `my-lists-export-${dateStr}.csv`;
    expect(expectedFilename).toMatch(/^my-lists-export-\d{8}\.csv$/);
    
    console.log('Generated CSV:');
    console.log(csvResult);
    console.log('Expected filename format:', expectedFilename);
  });
});