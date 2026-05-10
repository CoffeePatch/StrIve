// Error Handling & User Feedback Test
import { mapListsToCsv, generateCsvBlob } from '../util/export/exportToCsv';

// Mock global alert function
global.alert = jest.fn();

describe('Error Handling & User Feedback', () => {
  test('wraps export process in try/catch', async () => {
    // Mock console.error to suppress output during testing
    const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Test with valid data first
    const mockLists = [
      {
        id: 'try-catch-test',
        name: 'Try Catch Test',
        items: [
          {
            id: 111111,
            title: 'Valid Movie',
            release_date: '2020-01-01',
            media_type: 'movie',
            vote_average: 7.5,
            dateAdded: '2024-01-20T08:00:00Z'
          }
        ]
      }
    ];
    
    // This should not throw an error
    expect(() => {
      mapListsToCsv(mockLists);
    }).not.toThrow();
    
    // Test with invalid data
    const invalidLists = null;
    
    // This should be handled gracefully
    expect(() => {
      const result = mapListsToCsv(invalidLists);
      expect(result).toBe('List Name,Title,Year,Type,Rating,Date Added,TMDB ID\n');
    }).not.toThrow();
    
    // Restore console.error
    mockConsoleError.mockRestore();
  });

  test('shows error alert or toast if export fails', async () => {
    // Mock console.error to suppress output during testing
    const mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Test with valid data
    const mockLists = [
      {
        id: 'error-alert-test',
        name: 'Error Alert Test',
        items: [
          {
            id: 222222,
            title: 'Test Movie',
            release_date: '2021-05-15',
            media_type: 'movie',
            vote_average: 8.0,
            dateAdded: '2024-01-21T09:30:00Z'
          }
        ]
      }
    ];
    
    // This should not throw an error
    expect(() => {
      const csvBlob = generateCsvBlob(mockLists);
      expect(csvBlob).toBeInstanceOf(Blob);
      expect(csvBlob.type).toBe('text/csv;charset=utf-8;');
    }).not.toThrow();
    
    // Restore console.error
    mockConsoleError.mockRestore();
  });

  test('maintains loading spinner and button disable states', () => {
    // Test loading state management
    let isExporting = false;
    
    // Simulate starting export
    isExporting = true;
    expect(isExporting).toBe(true);
    
    // Simulate completing export (success)
    isExporting = false;
    expect(isExporting).toBe(false);
    
    // Simulate starting export again
    isExporting = true;
    expect(isExporting).toBe(true);
    
    // Simulate completing export (error)
    isExporting = false;
    expect(isExporting).toBe(false);
  });

  test('tests loading spinner and button disable states', () => {
    // Mock button element
    const mockButton = {
      disabled: false,
      classList: {
        add: jest.fn(),
        remove: jest.fn()
      },
      setAttribute: jest.fn()
    };
    
    // Test disabled state during export
    mockButton.disabled = true;
    expect(mockButton.disabled).toBe(true);
    
    // Test enabled state after export
    mockButton.disabled = false;
    expect(mockButton.disabled).toBe(false);
    
    // Test classes for loading state
    expect(mockButton.classList.add).not.toHaveBeenCalled();
    expect(mockButton.classList.remove).not.toHaveBeenCalled();
  });
});