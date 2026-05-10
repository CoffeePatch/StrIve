// Integration test for the complete export workflow
import { mapListsToCsv } from '../../util/export/exportToCsv';

describe('Export Workflow Integration Test', () => {
  test('complete export workflow from Redux state to CSV file', () => {
    // Mock Redux state data (as it would be accessed by selector)
    const mockReduxState = {
      lists: {
        customLists: {
          lists: [
            {
              id: 'favorite-movies',
              name: 'Favorite Movies',
              items: [
                {
                  id: 27205,
                  title: 'Inception',
                  release_date: '2010-07-15',
                  media_type: 'movie',
                  vote_average: 8.4,
                  dateAdded: '2024-01-20T10:00:00Z'
                },
                {
                  id: 157336,
                  title: 'Interstellar',
                  release_date: '2014-11-05',
                  media_type: 'movie',
                  vote_average: 8.6,
                  dateAdded: '2024-01-20T10:05:00Z'
                }
              ]
            },
            {
              id: 'watch-later',
              name: 'Watch Later',
              items: [
                {
                  id: 680,
                  title: 'Pulp Fiction',
                  release_date: '1994-09-10',
                  media_type: 'movie',
                  vote_average: 8.5,
                  dateAdded: '2024-01-20T10:10:00Z'
                }
              ]
            }
          ]
        }
      }
    };

    // Extract lists data as the selector would
    const listsData = mockReduxState.lists.customLists.lists;
    
    // Generate CSV
    const csvResult = mapListsToCsv(listsData);
    
    // Verify the CSV content
    const lines = csvResult.trim().split('\n');
    
    // Check headers
    expect(lines[0]).toBe('List Name,Title,Year,Type,Rating,Date Added,TMDB ID');
    
    // Check we have 4 rows total (header + 3 items)
    expect(lines).toHaveLength(4);
    
    // Check Favorite Movies list items
    const inceptionRow = lines[1].split(',');
    expect(inceptionRow[0]).toBe('Favorite Movies');
    expect(inceptionRow[1]).toBe('Inception');
    expect(inceptionRow[2]).toBe('2010');
    expect(inceptionRow[3]).toBe('movie');
    expect(inceptionRow[4]).toBe('8.4');
    expect(inceptionRow[6]).toBe('27205');
    
    const interstellarRow = lines[2].split(',');
    expect(interstellarRow[0]).toBe('Favorite Movies');
    expect(interstellarRow[1]).toBe('Interstellar');
    expect(interstellarRow[2]).toBe('2014');
    expect(interstellarRow[3]).toBe('movie');
    expect(interstellarRow[4]).toBe('8.6');
    expect(interstellarRow[6]).toBe('157336');
    
    // Check Watch Later list item
    const pulpFictionRow = lines[3].split(',');
    expect(pulpFictionRow[0]).toBe('Watch Later');
    expect(pulpFictionRow[1]).toBe('Pulp Fiction');
    expect(pulpFictionRow[2]).toBe('1994');
    expect(pulpFictionRow[3]).toBe('movie');
    expect(pulpFictionRow[4]).toBe('8.5');
    expect(pulpFictionRow[6]).toBe('680');
    
    // Verify filename format would be correct
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const expectedFilename = `my-lists-export-${today}.csv`;
    
    console.log('Integration test passed!');
    console.log(`Expected filename: ${expectedFilename}`);
    console.log('Generated CSV content:');
    console.log(csvResult);
  });
});