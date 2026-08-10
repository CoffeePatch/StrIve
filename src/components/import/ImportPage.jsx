import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useRequireAuth from '../../hooks/common/useRequireAuth';
import Header from '../layout/Header';
import { getAuth } from 'firebase/auth';
import { Download, Upload, FileText, AlertTriangle } from 'lucide-react';
import { downloadTemplateCsv } from '../../util/export/csvTemplate';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB client selection warning guard

const ImportPage = () => {
  const navigate = useNavigate();
  useRequireAuth();
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fileType, setFileType] = useState(null); // 'json' or 'csv'

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(`Selected file size (${(file.size / 1024 / 1024).toFixed(1)} MB) exceeds 10 MB limit.`);
      setSelectedFile(null);
      setFileType(null);
      return;
    }

    const isJson = file.name.endsWith('.json') || file.type === 'application/json';
    const isCsv = file.name.endsWith('.csv') || file.type === 'text/csv';

    if (!isJson && !isCsv) {
      setError('Please select a valid Strive Backup JSON file (.json) or CSV file (.csv).');
      setSelectedFile(null);
      setFileType(null);
      return;
    }

    setSelectedFile(file);
    setFileType(isJson ? 'json' : 'csv');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedFile) {
      setError('Please select a file to analyze.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const auth = getAuth();
      if (!auth.currentUser) {
        throw new Error('Authentication required. Please log in.');
      }
      const token = await auth.currentUser.getIdToken(true);

      const fileText = await selectedFile.text();
      const contentType = fileType === 'csv' ? 'text/csv' : 'application/json';

      const response = await fetch('/api/user/import/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': contentType,
          'Authorization': `Bearer ${token}`,
        },
        body: fileText,
      });

      if (response.status === 401) {
        setError('Authentication failed. Please log in again.');
        return;
      }

      if (response.status === 413) {
        setError('File size exceeds the serverless 4.0 MB request limit.');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error?.message || errorData?.message || `HTTP error ${response.status}`);
      }

      const analysisData = await response.json();

      navigate('/import/review', {
        state: {
          analysisData,
          rawPayload: fileText,
          isCsv: fileType === 'csv',
        },
      });
    } catch (err) {
      setError(err.message || 'An error occurred while analyzing the import file.');
      console.error('Import analysis error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface text-primary">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8 pt-24">
        <div className="max-w-2xl mx-auto bg-surface-hover border border-border rounded-2xl p-6 sm:p-8 shadow-xl">
          <h1 className="text-3xl font-bold font-display text-primary mb-2 text-center">
            Import Library Backup
          </h1>
          <p className="text-secondary text-sm text-center mb-8">
            Upload your Strive Backup JSON file or CSV spreadsheet to preview differences before importing.
          </p>

          {/* Backup Information Section */}
          <div className="mb-6 p-4 bg-emerald-950/30 border border-emerald-800/40 rounded-xl">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-emerald-400 shrink-0">verified</span>
              <div className="text-xs text-emerald-200 leading-relaxed">
                <span className="font-semibold block mb-1">Recommended: Strive Backup JSON (v1)</span>
                Includes complete media library, episode watch history, custom lists, ratings, custom notes, and dashboard layout preferences.
              </div>
            </div>
          </div>

          {/* CSV Template Download Section */}
          <div className="mb-6 p-4 bg-surface border border-border rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-primary mb-1 flex items-center gap-2">
                  <FileText size={16} />
                  Spreadsheet (CSV) Format
                </h2>
                <p className="text-xs text-secondary">
                  Import library items from CSV files. Download a template with standard headers.
                </p>
              </div>
              <button
                type="button"
                onClick={downloadTemplateCsv}
                className="btn-secondary text-xs flex items-center gap-1.5 shrink-0"
              >
                <Download size={14} />
                Template
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="importFile" className="block text-sm font-medium text-secondary mb-2">
                Select Backup File (.json or .csv)
              </label>
              <div className="mt-1 flex justify-center px-6 pt-6 pb-6 border-2 border-border border-dashed rounded-xl hover:border-accent transition-colors">
                <div className="space-y-2 text-center">
                  <Upload className="mx-auto h-8 w-8 text-secondary" />
                  <div className="flex text-sm text-secondary justify-center">
                    <label
                      htmlFor="importFile"
                      className="relative cursor-pointer font-medium text-accent hover:underline focus-within:outline-none"
                    >
                      <span>Choose file</span>
                      <input
                        id="importFile"
                        name="importFile"
                        type="file"
                        className="sr-only"
                        accept=".json,.csv,application/json,text/csv"
                        onChange={handleFileChange}
                      />
                    </label>
                  </div>
                  <p className="text-xs text-secondary">Strive Backup JSON or CSV files</p>
                  {selectedFile && (
                    <div className="mt-3 p-2 bg-surface rounded-lg border border-border">
                      <p className="text-xs font-semibold text-emerald-400">
                        Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="bg-red-950/40 border border-red-800/40 rounded-xl p-4 text-red-300 text-sm flex items-start gap-3">
                <AlertTriangle size={18} className="shrink-0 mt-0.5 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex justify-center">
              <button
                type="submit"
                disabled={loading || !selectedFile}
                className={`btn-primary w-full py-3 text-sm font-semibold flex items-center justify-center gap-2 ${
                  loading || !selectedFile ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? (
                  <>
                    <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white" />
                    <span>Analyzing Backup...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined">analytics</span>
                    <span>Analyze & Preview Diff</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};

export default ImportPage;