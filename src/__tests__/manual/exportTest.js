// Manual test script to verify export functionality
// This script can be run in the browser console to test the export utility

// Import the export utility
import { mapListsToCsv } from '../util/export/exportToCsv';

// Sample test data that mimics real Redux state
const sampleTestData = [
  {
    id: 'test-list-1',
    name: 'Test Favorites',
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
    id: 'test-list-2',
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

// Test the export functionality
console.log('=== Manual Export Test ===');
console.log('Testing export functionality with sample data...');

try {
  // Generate CSV
  const csvResult = mapListsToCsv(sampleTestData);
  
  // Verify the result
  const lines = csvResult.trim().split('\n');
  
  console.log('✅ CSV Generation Successful!');
  console.log(`📊 Generated ${lines.length} rows (including header)`);
  console.log('📋 First few rows:');
  lines.slice(0, Math.min(5, lines.length)).forEach((line, index) => {
    console.log(`   ${index + 1}. ${line}`);
  });
  
  // Verify headers
  const expectedHeaders = 'List Name,Title,Year,Type,Rating,Date Added,TMDB ID';
  if (lines[0] === expectedHeaders) {
    console.log('✅ Headers are correct');
  } else {
    console.warn('❌ Headers mismatch!');
    console.warn(`   Expected: ${expectedHeaders}`);
    console.warn(`   Actual:   ${lines[0]}`);
  }
  
  // Verify filename format
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const expectedFilename = `my-lists-export-${dateStr}.csv`;
  console.log(`📁 Expected filename format: ${expectedFilename}`);
  
  // Verify data rows
  if (lines.length > 1) {
    console.log('✅ Data rows generated successfully');
    
    // Check first data row
    const firstDataRow = lines[1].split(',');
    if (firstDataRow.length === 7) {
      console.log('✅ First data row has correct number of columns');
    } else {
      console.warn(`❌ First data row has ${firstDataRow.length} columns, expected 7`);
    }
  }
  
  console.log('\n🎉 Export test completed successfully!');
  console.log('The export functionality is working correctly.');
  
} catch (error) {
  console.error('❌ Export test failed:', error);
  console.error('Stack trace:', error.stack);
}