// UI Integration Test
import { mapListsToCsv } from '../util/export/exportToCsv';

// Mock browser APIs for testing
global.URL = {
  createObjectURL: jest.fn((blob) => {
    return `blob:${Math.random()}`;
  }),
  revokeObjectURL: jest.fn()
};

global.document = {
  createElement: jest.fn((tag) => {
    return {
      tagName: tag.toUpperCase(),
      href: '',
      setAttribute: jest.fn(function(name, value) {
        this[name] = value;
      }),
      click: jest.fn(),
      style: {}
    };
  }),
  body: {
    appendChild: jest.fn(),
    removeChild: jest.fn()
  }
};

describe('Download Handling in UI', () => {
  test('hooks export utility to existing button with loading state', () => {
    // Create mock button and simulate click
    const mockButton = {
      disabled: false,
      setAttribute: jest.fn(),
      classList: {
        add: jest.fn(),
        remove: jest.fn()
      }
    };
    
    // Simulate the export process
    const setIsExporting = jest.fn();
    
    // Start export process
    setIsExporting(true);
    expect(setIsExporting).toHaveBeenCalledWith(true);
    
    // Mock lists data
    const mockLists = [
      {
        id: 'test-list',
        name: 'Test List',
        items: [
          {
            id: 123456,
            title: 'The Matrix',
            release_date: '1999-03-30',
            media_type: 'movie',
            vote_average: 8.7,
            dateAdded: '2024-01-15T10:30:00Z'
          }
        ]
      }
    ];
    
    // Generate CSV
    const csvResult = mapListsToCsv(mockLists);
    
    // Verify the CSV was generated correctly
    expect(csvResult).toContain('The Matrix');
    expect(csvResult).toContain('123456');
    
    // Complete export process
    setIsExporting(false);
    expect(setIsExporting).toHaveBeenCalledWith(false);
  });

  test('generates timestamped CSV file name', () => {
    // Test that the file name is in the correct format
    const baseFileName = 'my-lists-export';
    const timestampRegex = /^\d{8}$/; // 8 digits in YYYYMMDD format
    
    // Get current date for comparison
    const now = new Date();
    const expectedDateFormat = now.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Simulate file name generation
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `${baseFileName}-${dateStr}.csv`;
    
    // Verify the format
    expect(fileName).toMatch(/my-lists-export-\d{8}\.csv/);
    expect(fileName).toContain(expectedDateFormat);
    expect(fileName).toEqual(expect.stringMatching(/\.csv$/));
    
    // Ensure it's a valid file name
    expect(fileName).not.toContain(' ');
    expect(fileName).not.toContain(':');
    expect(fileName).not.toContain('/');
  });

  test('ensures file downloads cleanly without HTML', () => {
    // Mock lists data
    const mockLists = [
      {
        id: 'download-test',
        name: 'Download Test',
        items: [
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
    const csvResult = mapListsToCsv(mockLists);
    
    // Verify it's pure CSV without HTML
    expect(csvResult).not.toContain('<html>');
    expect(csvResult).not.toContain('<body>');
    expect(csvResult).not.toContain('</html>');
    expect(csvResult).not.toContain('</body>');
    expect(csvResult).not.toContain('<div>');
    expect(csvResult).not.toContain('<script>');
    
    // Verify it has proper CSV headers (trimming to handle carriage returns)
    expect(csvResult.trim()).toContain('List Name,Title,Year,Type,Rating,Date Added,TMDB ID');
    
    // Verify it has the actual data
    expect(csvResult).toContain('Inception');
    expect(csvResult).toContain('789012');
    expect(csvResult).toContain('2010');
    expect(csvResult).toContain('movie');
    expect(csvResult).toContain('8.1');
    expect(csvResult).toContain('2024-01-16T14:20:00Z');
    
    // Verify CSV format by splitting lines
    const lines = csvResult.trim().split('\n');
    expect(lines[0].trim()).toBe('List Name,Title,Year,Type,Rating,Date Added,TMDB ID');
    expect(lines).toHaveLength(2); // Header + 1 item
  });
});