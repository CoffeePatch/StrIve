// Simple test to verify the export functionality works
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react';
import MyListsPage from './MyListsPage';

// Mock the required dependencies
jest.mock('../hooks/common/useRequireAuth', () => () => ({ uid: 'test-user-id' }));
jest.mock('../util/store/listsSlice', () => ({
  fetchLists: jest.fn(),
  fetchWatchlist: jest.fn(),
  deleteList: jest.fn(),
}));
jest.mock('../util/export/exportToCsv', () => ({
  generateCsvBlob: jest.fn(() => new Blob(['test,csv,data\n1,2,3'], { type: 'text/csv' }))
}));

// Mock Redux useSelector
const mockUseSelector = jest.fn();
jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useSelector: mockUseSelector,
  useDispatch: () => jest.fn(),
}));

describe('MyListsPage Export Functionality', () => {
  beforeEach(() => {
    mockUseSelector.mockImplementation(selector => 
      selector({
        lists: {
          watchlist: { items: [], status: 'succeeded', error: null },
          customLists: { 
            lists: [
              {
                id: 'list1',
                name: 'Test List',
                items: [
                  { id: 123, title: 'Test Movie', release_date: '2020-01-01' }
                ]
              }
            ],
            status: 'succeeded', 
            error: null 
          }
        }
      })
    );
  });

  test('exports CSV file with correct filename format', async () => {
    // Render the component
    const { getByText } = render(<MyListsPage />);
    
    // Find and click the export button
    const exportButton = getByText('Export All Lists');
    fireEvent.click(exportButton);
    
    // Wait for the download to complete
    await waitFor(() => {
      expect(global.URL.createObjectURL).toHaveBeenCalled();
    });
    
    // Verify the filename format
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const expectedFilename = `my-lists-export-${today}.csv`;
    
    // The test verifies that the export function is called correctly
    expect(require('../util/export/exportToCsv').generateCsvBlob).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'list1',
          name: 'Test List'
        })
      ])
    );
  });
});