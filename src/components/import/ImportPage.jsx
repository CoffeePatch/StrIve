import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import useRequireAuth from '../../hooks/common/useRequireAuth';
import { fetchLists } from '../../util/listsSlice';
import Header from '../layout/Header';
import { getAuth } from 'firebase/auth';
import { downloadTemplateCsv, getExpectedHeaders } from '../../util/csvTemplate';
import { Download, Upload, FileText } from 'lucide-react';

const EXPECTED_HEADERS = getExpectedHeaders();

const ImportPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const user = useRequireAuth();
  
  const [selectedListId, setSelectedListId] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [headerValid, setHeaderValid] = useState(null);

  const { lists, status, error: listsError } = useSelector((state) => state.lists.userLists);

  useEffect(() => {
    if (user) {
      dispatch(fetchLists(user.uid));
    }
  }, [dispatch, user]);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setError('Please select a valid CSV file.');
      setSelectedFile(null);
      setHeaderValid(null);
      return;
    }

    setSelectedFile(file);
    setError('');

    // Client-side header validation
    try {
      const text = await file.text();
      const firstLine = text.split('\n')[0].trim();
      const headers = firstLine.split(',');
      const valid = headers.length === EXPECTED_HEADERS.length && headers.every((h, i) => h === EXPECTED_HEADERS[i]);
      setHeaderValid(valid);
      if (!valid) {
        if (headers.includes('Letterboxd URI') || headers.includes('Name') || (headers.includes('Year') && !headers.includes('year'))) {
          setError('Legacy CSV format detected. Please export from the app to get the correct format.');
        } else {
          setError(`Invalid CSV headers. Expected: ${EXPECTED_HEADERS.join(',')}`);
        }
      }
    } catch (err) {
      console.error('Error reading file:', err);
      setHeaderValid(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedListId) {
      setError('Please select a list to import to.');
      return;
    }
    
    if (!selectedFile) {
      setError('Please select a CSV file to upload.');
      return;
    }

    if (headerValid === false) {
      setError('CSV headers are invalid. Please correct them before proceeding.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const auth = getAuth();
      const token = await auth.currentUser.getIdToken(true);

      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(`/lists/${encodeURIComponent(selectedListId)}/import/analyze`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.status === 401) {
        setError('Authentication failed. Please log in again.');
        return;
      }
      if (response.status === 403) {
        setError('You do not have permission to access this list.');
        return;
      }
      if (response.status === 404) {
        setError('List not found.');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const analysisData = await response.json();

      if (analysisData.matched.length === 0 && analysisData.unmatched.length === 0) {
        setError('No items found to import. All items are duplicates or the CSV is empty.');
        return;
      }
      
      navigate('/import/review', { state: { analysisData, listId: selectedListId } });
    } catch (err) {
      setError(err.message || 'An error occurred while analyzing the CSV file.');
      console.error('Import error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8 pt-16">
        <div className="max-w-2xl mx-auto bg-gray-900 rounded-xl p-6 shadow-lg">
          <h1 className="text-3xl font-bold text-white mb-6 text-center">Import CSV to Your List</h1>

          {/* Template Download Section */}
          <div className="mb-6 p-4 bg-green-900/20 border border-green-700 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h2 className="text-sm font-semibold text-green-300 mb-2 flex items-center gap-2">
                  <FileText size={16} />
                  Need a Template?
                </h2>
                <p className="text-xs text-gray-300 mb-2">
                  Download a template CSV with the correct format and an example row.
                </p>
              </div>
              <button
                onClick={downloadTemplateCsv}
                className="ml-4 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md text-sm flex items-center gap-2 transition-colors shrink-0"
                aria-label="Download template CSV"
              >
                <Download size={14} />
                Download Template
              </button>
            </div>
          </div>

          {/* Format Info Section */}
          <div className="mb-6 p-4 bg-blue-900/30 border border-blue-700 rounded-lg">
            <h2 className="text-sm font-semibold text-blue-300 mb-2">Required CSV Format</h2>
            <p className="text-xs text-gray-300 mb-2">Your CSV must have these exact headers (case-sensitive):</p>
            <code className="block text-xs bg-gray-800 p-2 rounded text-green-400 overflow-x-auto">
              {EXPECTED_HEADERS.join(',')}
            </code>
            <p className="text-xs text-gray-400 mt-2">
              • IMDb fields (imdbId, imdbRating, imdbVotes) may be empty<br />
              • TMDB is the primary data source<br />
              • Large files may take longer to analyze
            </p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="listSelect" className="block text-sm font-medium text-gray-300 mb-2">
                Select a List to Import To
              </label>
              <select
                id="listSelect"
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-600"
                disabled={status === 'loading'}
              >
                <option value="">Choose a list...</option>
                <option value="watchlist">Watchlist</option>
                {lists && lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
              
              {listsError && (
                <p className="text-red-500 text-sm mt-2">Error loading lists: {listsError}</p>
              )}
            </div>

            {/* File upload */}
            <div>
              <label htmlFor="csvFile" className="block text-sm font-medium text-gray-300 mb-2">
                Upload CSV File
              </label>
              <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-700 border-dashed rounded-lg">
                <div className="space-y-1 text-center">
                  <div className="flex text-sm text-gray-400 justify-center">
                    <label
                      htmlFor="csvFile"
                      className="relative cursor-pointer bg-gray-800 rounded-md font-medium text-red-600 hover:text-red-500 focus-within:outline-none"
                    >
                      <span>Upload a CSV file</span>
                      <input
                        id="csvFile"
                        name="csvFile"
                        type="file"
                        className="sr-only"
                        accept=".csv,text/csv"
                        onChange={handleFileChange}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-gray-500">CSV files only</p>
                  {selectedFile && (
                    <div className="mt-2">
                      <p className="text-sm text-green-500">
                        Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(2)} KB)
                      </p>
                      {headerValid === true && (
                        <p className="text-xs text-green-400 mt-1">✓ Headers validated</p>
                      )}
                      {headerValid === false && (
                        <p className="text-xs text-red-400 mt-1">✗ Invalid headers</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-900/50 border border-red-700 rounded-lg p-4 text-red-300 text-center">
                {error}
              </div>
            )}

            <div className="flex justify-center">
              <button
                type="submit"
                disabled={loading || !selectedListId || !selectedFile || headerValid === false}
                aria-busy={loading}
                className={`px-6 py-3 rounded-lg text-white font-semibold ${
                  loading || !selectedListId || !selectedFile || headerValid === false
                    ? 'bg-gray-700 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {loading ? (
                  <div className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing...
                  </div>
                ) : (
                  'Analyze & Import'
                )}
              </button>
            </div>
          </form>

          {/* User Guidance Panel */}
          <div className="mt-6 p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">Quick Tips</h3>
            <ul className="text-xs text-gray-400 space-y-2">
              <li className="flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                <span><strong>Header order matters:</strong> Must match exactly (case-sensitive)</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                <span><strong>IMDb fields optional:</strong> Leave imdbId, imdbRating, imdbVotes empty if unknown</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                <span><strong>TMDB is primary:</strong> We use tmdbId for matching, IMDb for ratings</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                <span><strong>Large files:</strong> Files with 500+ rows may take 10-30 seconds to analyze</span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-400 mr-2">•</span>
                <span><strong>Review step:</strong> You'll be able to select which items to import</span>
              </li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ImportPage;