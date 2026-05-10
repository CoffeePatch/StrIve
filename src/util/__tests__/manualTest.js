// Test the CSV export functionality
import { mapListsToCsv } from '../export/exportToCsv';

// Sample test data
const testData = [
  {
    id: 'list1',
    name: 'Test List',
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
  }
];

// Generate CSV
const csvResult = mapListsToCsv(testData);
console.log('Generated CSV:');
console.log(csvResult);

// Expected output:
// List Name,Title,Year,Type,Rating,Date Added,TMDB ID
// Test List,The Matrix,1999,movie,8.7,,123456
// Test List,Inception,2010,movie,8.1,,789012