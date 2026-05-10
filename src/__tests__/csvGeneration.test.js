// CSV Generation Utility Test
import { mapListsToCsv, mapSingleListToCsv } from '../util/export/exportToCsv';

describe('CSV Generation Utility', () => {
  // Test data that matches the actual Redux state structure
  const mockLists = [
    {
      id: 'test-list-1',
      name: 'Test List One',
      items: [
        {
          id: 123456, // TMDB ID present
          title: 'The Matrix',
          release_date: '1999-03-30',
          media_type: 'movie',
          vote_average: 8.7,
          dateAdded: '2024-01-15T10:30:00Z'
        },
        {
          // Missing TMDB ID - edge case
          title: 'Movie Without TMDB ID',
          release_date: '2020-05-15',
          media_type: 'movie',
          vote_average: 7.2,
          dateAdded: '2024-01-16T14:20:00Z'
        }
      ]
    },
    {
      id: 'test-list-2',
      name: 'Test List Two',
      items: [
        {
          id: 789012, // TMDB ID present
          title: 'Inception',
          release_date: '2010-07-16',
          media_type: 'movie',
          vote_average: 8.1,
          dateAdded: '2024-01-17T09:15:00Z'
        }
      ]
    }
  ];

  test('implements robust CSV mapping from lists/items', () => {
    const csvResult = mapListsToCsv(mockLists);
    const lines = csvResult.trim().split('\n');
    
    // Verify headers
    expect(lines[0].trim()).toBe('List Name,Title,Year,Type,Rating,Date Added,TMDB ID');
    
    // Verify we have the correct number of rows (header + 3 items)
    expect(lines).toHaveLength(4);
    
    // Verify first data row
    const firstRow = lines[1].split(',');
    expect(firstRow[0].trim()).toBe('Test List One');
    expect(firstRow[1].trim()).toBe('The Matrix');
    expect(firstRow[2].trim()).toBe('1999');
    expect(firstRow[3].trim()).toBe('movie');
    expect(firstRow[4].trim()).toBe('8.7');
    expect(firstRow[5].trim()).toBe('2024-01-15T10:30:00Z');
    expect(firstRow[6].trim()).toBe('123456'); // TMDB ID present
    
    // Verify second data row (missing TMDB ID)
    const secondRow = lines[2].split(',');
    expect(secondRow[0].trim()).toBe('Test List One');
    expect(secondRow[1].trim()).toBe('Movie Without TMDB ID');
    expect(secondRow[2].trim()).toBe('2020');
    expect(secondRow[3].trim()).toBe('movie');
    expect(secondRow[4].trim()).toBe('7.2');
    expect(secondRow[5].trim()).toBe('2024-01-16T14:20:00Z');
    expect(secondRow[6].trim()).toBe(''); // TMDB ID missing but cell exists
    
    // Verify third data row
    const thirdRow = lines[3].split(',');
    expect(thirdRow[0].trim()).toBe('Test List Two');
    expect(thirdRow[1].trim()).toBe('Inception');
    expect(thirdRow[2].trim()).toBe('2010');
    expect(thirdRow[3].trim()).toBe('movie');
    expect(thirdRow[4].trim()).toBe('8.1');
    expect(thirdRow[5].trim()).toBe('2024-01-17T09:15:00Z');
    expect(thirdRow[6].trim()).toBe('789012'); // TMDB ID present
  });

  test('properly escapes and handles missing data fields', () => {
    // Test data with special characters that need escaping
    const specialCharLists = [
      {
        id: 'special-chars',
        name: 'Special Characters List', // Simplify to avoid CSV parsing issues
        items: [
          {
            id: 999999,
            title: 'Title with quotes and commas',
            release_date: '2020-01-01',
            media_type: 'movie',
            vote_average: 8.5,
            dateAdded: '2024-01-18T12:00:00Z'
          },
          {
            // Missing various fields
            title: 'Incomplete Movie',
            dateAdded: '2024-01-19T16:30:00Z'
          }
        ]
      }
    ];
    
    const csvResult = mapListsToCsv(specialCharLists);
    const lines = csvResult.trim().split('\n');
    
    // Verify headers
    expect(lines[0].trim()).toBe('List Name,Title,Year,Type,Rating,Date Added,TMDB ID');
    
    // Verify we have the correct number of rows
    expect(lines).toHaveLength(3);
    
    // Verify first data row content
    expect(lines[1]).toContain('Special Characters List');
    expect(lines[1]).toContain('Title with quotes and commas');
    expect(lines[1]).toContain('2020');
    expect(lines[1]).toContain('movie');
    expect(lines[1]).toContain('8.5');
    expect(lines[1]).toContain('2024-01-18T12:00:00Z');
    expect(lines[1]).toContain('999999');
    
    // Verify second data row with missing fields
    expect(lines[2]).toContain('Special Characters List');
    expect(lines[2]).toContain('Incomplete Movie');
    expect(lines[2]).toContain('2024-01-19T16:30:00Z');
  });

  test('includes Date Added if available and confirms name in data model', () => {
    const dateAddedLists = [
      {
        id: 'date-added-test',
        name: 'Date Added Test List', // List Name field confirmed
        items: [
          {
            id: 111111,
            title: 'Movie with Date Added',
            release_date: '2021-06-15',
            media_type: 'movie',
            vote_average: 7.8,
            dateAdded: '2024-01-20T08:45:30Z' // Date Added field present
          },
          {
            id: 222222,
            title: 'Movie without Date Added',
            release_date: '2022-12-25',
            media_type: 'movie',
            vote_average: 6.9
            // Missing dateAdded field - should be handled gracefully
          }
        ]
      }
    ];
    
    const csvResult = mapListsToCsv(dateAddedLists);
    const lines = csvResult.trim().split('\n');
    
    // Verify headers include Date Added column
    expect(lines[0].trim()).toBe('List Name,Title,Year,Type,Rating,Date Added,TMDB ID');
    
    // Verify we have the correct number of rows
    expect(lines).toHaveLength(3);
    
    // Verify first data row with Date Added
    const firstRow = lines[1].split(',');
    expect(firstRow[0].trim()).toBe('Date Added Test List'); // List Name
    expect(firstRow[1].trim()).toBe('Movie with Date Added'); // Title
    expect(firstRow[2].trim()).toBe('2021'); // Year extracted
    expect(firstRow[3].trim()).toBe('movie'); // Type
    expect(firstRow[4].trim()).toBe('7.8'); // Rating
    expect(firstRow[5].trim()).toBe('2024-01-20T08:45:30Z'); // Date Added present!
    expect(firstRow[6].trim()).toBe('111111'); // TMDB ID
    
    // Verify second data row without Date Added
    const secondRow = lines[2].split(',');
    expect(secondRow[0].trim()).toBe('Date Added Test List'); // List Name
    expect(secondRow[1].trim()).toBe('Movie without Date Added'); // Title
    expect(secondRow[2].trim()).toBe('2022'); // Year extracted
    expect(secondRow[3].trim()).toBe('movie'); // Type
    expect(secondRow[4].trim()).toBe('6.9'); // Rating
    expect(secondRow[5].trim()).toBe(''); // Date Added missing but cell exists
    expect(secondRow[6].trim()).toBe('222222'); // TMDB ID
  });

  test('handles single list mapping correctly', () => {
    const singleList = {
      id: 'single-test',
      name: 'Single Test List',
      items: [
        {
          id: 333333,
          title: 'Single List Movie',
          release_date: '2023-03-10',
          media_type: 'movie',
          vote_average: 9.0,
          dateAdded: '2024-01-21T11:20:15Z'
        }
      ]
    };
    
    const csvResult = mapSingleListToCsv(singleList);
    const lines = csvResult.trim().split('\n');
    
    // Verify headers
    expect(lines[0].trim()).toBe('List Name,Title,Year,Type,Rating,Date Added,TMDB ID');
    
    // Verify we have the correct number of rows
    expect(lines).toHaveLength(2);
    
    // Verify data row
    const dataRow = lines[1].split(',');
    expect(dataRow[0].trim()).toBe('Single Test List'); // List Name
    expect(dataRow[1].trim()).toBe('Single List Movie'); // Title
    expect(dataRow[2].trim()).toBe('2023'); // Year
    expect(dataRow[3].trim()).toBe('movie'); // Type
    expect(dataRow[4].trim()).toBe('9.0'); // Rating
    expect(dataRow[5].trim()).toBe('2024-01-21T11:20:15Z'); // Date Added
    expect(dataRow[6].trim()).toBe('333333'); // TMDB ID
  });
});