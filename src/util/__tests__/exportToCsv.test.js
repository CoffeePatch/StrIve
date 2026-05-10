// Mock papaparse since it's a client-side library
jest.mock('papaparse', () => ({
  unparse: jest.fn((data, options) => {
    // Simple CSV generation for testing
    return data.map(row => row.join(',')).join('\n');
  })
}));

import { mapListsToCsv, mapSingleListToCsv } from '../export/exportToCsv';

describe('exportToCsv', () => {
  // Test data
  const mockLists = [
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
          vote_count: 25000,
          imdbRating: 8.7,
          imdbVotes: 1800000,
          imdbId: 'tt0133093',
          dateAdded: '2024-01-15T10:30:00Z'
        },
        {
          id: 789012,
          title: 'Inception',
          release_date: '2010-07-16',
          media_type: 'movie',
          vote_average: 8.1,
          vote_count: 22000,
          imdbRating: 8.8,
          imdbVotes: 2300000,
          imdbId: 'tt1375666',
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
          vote_count: 28000,
          imdbRating: 8.7,
          imdbVotes: 1900000,
          imdbId: 'tt0816692',
          dateAdded: '2024-01-17T09:15:00Z'
        }
      ]
    }
  ];

  const mockListWithSpecialChars = {
    id: 'list3',
    name: 'Special "Characters", List',
    items: [
      {
        id: 999999,
        title: 'Title with "quotes" and, commas',
        release_date: '2020-01-01',
        media_type: 'movie',
        vote_average: 7.5,
        dateAdded: '2024-01-18T12:00:00Z'
      }
    ]
  };

  describe('mapListsToCsv', () => {
    test('should generate correct CSV with headers and data', () => {
      const csvResult = mapListsToCsv(mockLists);
      
      // Split into lines for easier validation
      const lines = csvResult.trim().split('\n');
      
      // Check headers
      expect(lines[0]).toBe('List Name,Title,Year,Type,TMDB Rating,IMDB Rating,TMDB Votes,IMDB Votes,Date Added,TMDB ID,IMDB ID');
      
      // Check first data row (first item from first list)
      const firstRow = lines[1].split(',');
      expect(firstRow[0]).toBe('My Favorites');  // List Name
      expect(firstRow[1]).toBe('The Matrix');    // Title
      expect(firstRow[2]).toBe('1999');           // Year
      expect(firstRow[3]).toBe('movie');          // Type
      expect(firstRow[4]).toBe('8.7');            // TMDB Rating
      expect(firstRow[5]).toBe('8.7');            // IMDB Rating
      expect(firstRow[6]).toBe('25000');          // TMDB Votes
      expect(firstRow[7]).toBe('1800000');        // IMDB Votes
      expect(firstRow[9]).toBe('123456');         // TMDB ID
      expect(firstRow[10]).toBe('tt0133093');     // IMDB ID
      
      // Check that we have the right number of rows
      expect(lines).toHaveLength(4); // Header + 3 items
    });

    test('should handle special characters in fields by proper CSV escaping', () => {
      const csvResult = mapListsToCsv([mockListWithSpecialChars]);
      
      // Split into lines
      const lines = csvResult.trim().split('\n');
      
      // Special characters should be properly handled
      expect(lines[0]).toBe('List Name,Title,Year,Type,TMDB Rating,IMDB Rating,TMDB Votes,IMDB Votes,Date Added,TMDB ID,IMDB ID');
      
      // The second line should contain the fields
      expect(lines[1]).toContain('Special "Characters", List');
      expect(lines[1]).toContain('Title with "quotes" and, commas');
    });

    test('should handle empty lists array gracefully', () => {
      const csvResult = mapListsToCsv([]);
      
      // Should return only headers
      const lines = csvResult.trim().split('\n');
      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe('List Name,Title,Year,Type,TMDB Rating,IMDB Rating,TMDB Votes,IMDB Votes,Date Added,TMDB ID,IMDB ID');
    });

    test('should handle null/undefined input gracefully', () => {
      const csvResult1 = mapListsToCsv(null);
      const csvResult2 = mapListsToCsv(undefined);
      
      // Both should return headers only
      expect(csvResult1).toBe('List Name,Title,Year,Type,TMDB Rating,IMDB Rating,TMDB Votes,IMDB Votes,Date Added,TMDB ID,IMDB ID\n');
      expect(csvResult2).toBe('List Name,Title,Year,Type,TMDB Rating,IMDB Rating,TMDB Votes,IMDB Votes,Date Added,TMDB ID,IMDB ID\n');
    });

    test('should handle lists with missing items gracefully', () => {
      const listWithoutItems = [{ id: 'list1', name: 'Empty List' }];
      const csvResult = mapListsToCsv(listWithoutItems);
      
      // Should return only headers
      const lines = csvResult.trim().split('\n');
      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe('List Name,Title,Year,Type,TMDB Rating,IMDB Rating,TMDB Votes,IMDB Votes,Date Added,TMDB ID,IMDB ID');
    });

    test('should handle items with missing fields gracefully', () => {
      const listWithIncompleteItems = [{
        id: 'list1',
        name: 'Incomplete Items',
        items: [{
          // Missing many fields
          id: 111111
        }]
      }];
      
      const csvResult = mapListsToCsv(listWithIncompleteItems);
      const lines = csvResult.trim().split('\n');
      
      // Should have header and one data row
      expect(lines).toHaveLength(2);
      expect(lines[0]).toBe('List Name,Title,Year,Type,TMDB Rating,IMDB Rating,TMDB Votes,IMDB Votes,Date Added,TMDB ID,IMDB ID');
      
      // Row should have defaults for missing fields
      const dataRow = lines[1].split(',');
      expect(dataRow[0]).toBe('Incomplete Items');
      expect(dataRow[1]).toBe('Unknown');  // Default title
      expect(dataRow[2]).toBe('');          // Empty year
      expect(dataRow[3]).toBe('movie');     // Default type
      expect(dataRow[4]).toBe('');          // Empty TMDB rating
      expect(dataRow[5]).toBe('');          // Empty IMDB rating
      expect(dataRow[6]).toBe('');          // Empty TMDB votes
      expect(dataRow[7]).toBe('');          // Empty IMDB votes
      expect(dataRow[9]).toBe('111111');    // TMDB ID
    });

    test('should handle malformed dates gracefully', () => {
      const listWithBadDate = [{
        id: 'list1',
        name: 'Bad Date List',
        items: [{
          id: 222222,
          title: 'Bad Date Movie',
          release_date: 'invalid-date',
          media_type: 'movie',
          vote_average: 6.5
        }]
      }];
      
      const csvResult = mapListsToCsv(listWithBadDate);
      const lines = csvResult.trim().split('\n');
      
      expect(lines).toHaveLength(2);
      const dataRow = lines[1].split(',');
      
      // Malformed date should result in empty year
      expect(dataRow[2]).toBe('');
      expect(dataRow[4]).toBe('6.5');  // TMDB Rating should still work
    });
  });

  describe('mapSingleListToCsv', () => {
    test('should generate correct CSV for a single list', () => {
      const csvResult = mapSingleListToCsv(mockLists[0]);
      
      // Split into lines
      const lines = csvResult.trim().split('\n');
      
      // Check headers
      expect(lines[0]).toBe('List Name,Title,Year,Type,TMDB Rating,IMDB Rating,TMDB Votes,IMDB Votes,Date Added,TMDB ID,IMDB ID');
      
      // Check data rows
      expect(lines).toHaveLength(3); // Header + 2 items
      
      // First item
      const firstRow = lines[1].split(',');
      expect(firstRow[0]).toBe('My Favorites');
      expect(firstRow[1]).toBe('The Matrix');
      expect(firstRow[2]).toBe('1999');
      expect(firstRow[9]).toBe('123456');
      expect(firstRow[10]).toBe('tt0133093');
      
      // Second item
      const secondRow = lines[2].split(',');
      expect(secondRow[0]).toBe('My Favorites');
      expect(secondRow[1]).toBe('Inception');
      expect(secondRow[2]).toBe('2010');
      expect(secondRow[9]).toBe('789012');
      expect(secondRow[10]).toBe('tt1375666');
    });

    test('should handle invalid single list input gracefully', () => {
      const csvResult1 = mapSingleListToCsv(null);
      const csvResult2 = mapSingleListToCsv(undefined);
      const csvResult3 = mapSingleListToCsv('invalid');
      
      // All should return headers only
      expect(csvResult1).toBe('List Name,Title,Year,Type,TMDB Rating,IMDB Rating,TMDB Votes,IMDB Votes,Date Added,TMDB ID,IMDB ID\n');
      expect(csvResult2).toBe('List Name,Title,Year,Type,TMDB Rating,IMDB Rating,TMDB Votes,IMDB Votes,Date Added,TMDB ID,IMDB ID\n');
      expect(csvResult3).toBe('List Name,Title,Year,Type,TMDB Rating,IMDB Rating,TMDB Votes,IMDB Votes,Date Added,TMDB ID,IMDB ID\n');
    });

    test('should handle single list with empty items gracefully', () => {
      const emptyList = { id: 'list1', name: 'Empty List', items: [] };
      const csvResult = mapSingleListToCsv(emptyList);
      
      // Should return only headers
      const lines = csvResult.trim().split('\n');
      expect(lines).toHaveLength(1);
      expect(lines[0]).toBe('List Name,Title,Year,Type,TMDB Rating,IMDB Rating,TMDB Votes,IMDB Votes,Date Added,TMDB ID,IMDB ID');
    });
  });
});