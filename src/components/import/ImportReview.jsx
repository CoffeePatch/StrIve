import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import useRequireAuth from '../../hooks/common/useRequireAuth';
import Header from '../layout/Header';
import { getAuth } from 'firebase/auth';
import { createImportBatches } from '../../domain/import/importController';
import { AlertTriangle, CheckCircle, RefreshCw, XCircle, ArrowLeft } from 'lucide-react';

const ImportReview = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useRequireAuth();
  
  const { analysisData, rawPayload } = location.state || {};
  
  const [conflictStrategy, setConflictStrategy] = useState('MERGE');
  const [showOverwriteWarning, setShowOverwriteWarning] = useState(false);
  const [showConflictInspector, setShowConflictInspector] = useState(false);

  // Import Execution State
  const [isImporting, setIsImporting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [currentBatchIndex, setCurrentBatchIndex] = useState(0);
  const [totalBatches, setTotalBatches] = useState(0);
  const [failedBatchIndex, setFailedBatchIndex] = useState(null);
  const [importError, setImportError] = useState('');

  const [stats, setStats] = useState({
    processed: 0,
    created: 0,
    updated: 0,
    skipped: 0,
  });

  if (!analysisData) {
    return (
      <div className="min-h-screen flex flex-col bg-surface text-primary">
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8 pt-24 flex items-center justify-center">
          <div className="text-center bg-surface-hover border border-border rounded-2xl p-8 max-w-md">
            <h1 className="text-2xl font-bold font-display text-primary">No Analysis Preview Found</h1>
            <p className="text-secondary text-sm mt-2">Please upload a backup file to preview differences.</p>
            <button 
              onClick={() => navigate('/import')}
              className="btn-primary mt-6 text-sm px-6 py-2"
            >
              Go to Import Page
            </button>
          </div>
        </main>
      </div>
    );
  }

  const { summary, conflicts = [], warnings = [] } = analysisData;

  const handleStrategyChange = (newStrategy) => {
    setConflictStrategy(newStrategy);
    if (newStrategy === 'OVERWRITE') {
      setShowOverwriteWarning(true);
    } else {
      setShowOverwriteWarning(false);
    }
  };

  const executeImportSequence = async (startFromBatch = 0) => {
    if (!user || !rawPayload) {
      setImportError('Missing user authentication or backup payload');
      return;
    }

    setIsImporting(true);
    setImportError('');
    setFailedBatchIndex(null);

    let parsedPayload;
    try {
      parsedPayload = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
    } catch (e) {
      setImportError(`Failed to parse backup payload: ${e.message}`);
      setIsImporting(false);
      return;
    }

    const batches = createImportBatches(parsedPayload, 100);
    setTotalBatches(batches.length);

    if (batches.length === 0) {
      setImportError('No valid batches found to import.');
      setIsImporting(false);
      return;
    }

    const auth = getAuth();

    for (let i = startFromBatch; i < batches.length; i++) {
      setCurrentBatchIndex(i);

      try {
        if (!auth.currentUser) {
          throw new Error('Authentication expired. Please log in again.');
        }
        const token = await auth.currentUser.getIdToken(true);

        const response = await fetch('/api/user/import/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            batchPayload: batches[i],
            conflictStrategy,
          }),
        });

        if (!response.ok) {
          const errObj = await response.json().catch(() => ({}));
          throw new Error(errObj?.error?.message || errObj?.message || `HTTP Error ${response.status}`);
        }

        const result = await response.json();

        setStats(prev => ({
          processed: prev.processed + (result.processed || 0),
          created: prev.created + (result.created || 0),
          updated: prev.updated + (result.updated || 0),
          skipped: prev.skipped + (result.skipped || 0),
        }));
      } catch (err) {
        console.error(`Import error on batch ${i}:`, err);
        setFailedBatchIndex(i);
        setImportError(`Batch ${i + 1} of ${batches.length} failed: ${err.message}`);
        setIsImporting(false);
        return;
      }
    }

    setIsImporting(false);
    setIsCompleted(true);
  };

  const handleStartImport = () => {
    setStats({ processed: 0, created: 0, updated: 0, skipped: 0 });
    executeImportSequence(0);
  };

  const handleRetryFailedBatch = () => {
    if (failedBatchIndex !== null) {
      executeImportSequence(failedBatchIndex);
    }
  };

  const handleCancelRemaining = () => {
    setIsImporting(false);
    setFailedBatchIndex(null);
    setImportError('Import remaining batches cancelled. Completed batches remain restored.');
  };

  const progressPercent = totalBatches > 0
    ? Math.round(((currentBatchIndex + (isCompleted ? 1 : 0)) / totalBatches) * 100)
    : 0;

  return (
    <div className="min-h-screen flex flex-col bg-surface text-primary">
      <Header />
      <main className="flex-grow container mx-auto px-4 py-8 pt-24">
        <div className="max-w-5xl mx-auto space-y-8">
          
          {/* Top Bar */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/import')}
              className="btn-secondary text-xs flex items-center gap-2"
              disabled={isImporting}
            >
              <ArrowLeft size={16} />
              <span>Back to Upload</span>
            </button>
            <h1 className="text-3xl font-bold font-display text-primary">
              Review Import & Confirm
            </h1>
            <div className="w-24" />
          </div>

          {/* Warnings Banner */}
          {warnings.length > 0 && (
            <div className="p-4 bg-amber-950/40 border border-amber-800/40 rounded-xl text-amber-300 text-xs space-y-1">
              <div className="font-semibold flex items-center gap-2 text-sm">
                <AlertTriangle size={16} />
                <span>Import Analysis Warnings ({warnings.length})</span>
              </div>
              {warnings.map((w, idx) => (
                <div key={idx}>• {w}</div>
              ))}
            </div>
          )}

          {/* Import Complete Card */}
          {isCompleted && (
            <div className="p-8 bg-emerald-950/40 border border-emerald-800/60 rounded-2xl text-center space-y-4">
              <CheckCircle className="mx-auto h-12 w-12 text-emerald-400" />
              <h2 className="text-2xl font-bold font-display text-emerald-200">
                Import Complete!
              </h2>
              <p className="text-secondary text-sm">
                Your media library and relational data have been updated in PostgreSQL.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-xl mx-auto pt-2">
                <div className="bg-surface p-3 rounded-xl border border-border">
                  <div className="text-xs text-secondary">Processed</div>
                  <div className="text-xl font-bold text-accent">{stats.processed}</div>
                </div>
                <div className="bg-surface p-3 rounded-xl border border-border">
                  <div className="text-xs text-secondary">Created</div>
                  <div className="text-xl font-bold text-emerald-400">{stats.created}</div>
                </div>
                <div className="bg-surface p-3 rounded-xl border border-border">
                  <div className="text-xs text-secondary">Updated</div>
                  <div className="text-xl font-bold text-blue-400">{stats.updated}</div>
                </div>
                <div className="bg-surface p-3 rounded-xl border border-border">
                  <div className="text-xs text-secondary">Skipped</div>
                  <div className="text-xl font-bold text-amber-400">{stats.skipped}</div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={() => navigate('/library')}
                  className="btn-primary px-8 py-3 text-sm font-semibold"
                >
                  Return to Library
                </button>
              </div>
            </div>
          )}

          {/* Active Progress Bar */}
          {isImporting && (
            <div className="p-6 bg-surface-hover border border-border rounded-2xl space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-primary">
                  Importing Batch {currentBatchIndex + 1} of {totalBatches}...
                </span>
                <span className="text-accent font-bold">{progressPercent}%</span>
              </div>

              <div className="h-3 rounded-full bg-surface overflow-hidden border border-border">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-xs text-secondary pt-1">
                <span>Created: {stats.created}</span>
                <span>Updated: {stats.updated}</span>
                <span>Skipped: {stats.skipped}</span>
              </div>
            </div>
          )}

          {/* Error & Retry Panel */}
          {importError && !isCompleted && (
            <div className="p-6 bg-red-950/40 border border-red-800/40 rounded-2xl space-y-4">
              <div className="flex items-start gap-3">
                <XCircle className="h-6 w-6 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="font-bold text-red-200 text-sm">Import Progress Paused</div>
                  <div className="text-xs text-red-300">{importError}</div>
                </div>
              </div>

              {failedBatchIndex !== null && (
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleRetryFailedBatch}
                    className="btn-primary text-xs flex items-center gap-1.5"
                  >
                    <RefreshCw size={14} />
                    <span>Retry Batch {failedBatchIndex + 1}</span>
                  </button>
                  <button
                    onClick={handleCancelRemaining}
                    className="btn-secondary text-xs"
                  >
                    Cancel Remaining Batches
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Summary Preview Cards */}
          {!isCompleted && !isImporting && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Library Card */}
                <div className="bg-surface-hover border border-border rounded-2xl p-5 space-y-2">
                  <div className="text-xs text-secondary font-semibold uppercase tracking-wider">Library Items</div>
                  <div className="text-3xl font-bold text-primary">{summary?.library?.total || 0}</div>
                  <div className="text-xs space-y-1 pt-2 border-t border-border/60">
                    <div className="flex justify-between"><span className="text-secondary">New:</span> <span className="text-emerald-400 font-semibold">{summary?.library?.new || 0}</span></div>
                    <div className="flex justify-between"><span className="text-secondary">Identical:</span> <span className="text-secondary font-semibold">{summary?.library?.identical || 0}</span></div>
                    <div className="flex justify-between"><span className="text-secondary">Conflicts:</span> <span className="text-amber-400 font-semibold">{summary?.library?.conflicts || 0}</span></div>
                  </div>
                </div>

                {/* Episodes Card */}
                <div className="bg-surface-hover border border-border rounded-2xl p-5 space-y-2">
                  <div className="text-xs text-secondary font-semibold uppercase tracking-wider">TV Episode States</div>
                  <div className="text-3xl font-bold text-primary">{summary?.episodes?.total || 0}</div>
                  <div className="text-xs space-y-1 pt-2 border-t border-border/60">
                    <div className="flex justify-between"><span className="text-secondary">New:</span> <span className="text-emerald-400 font-semibold">{summary?.episodes?.new || 0}</span></div>
                    <div className="flex justify-between"><span className="text-secondary">Identical:</span> <span className="text-secondary font-semibold">{summary?.episodes?.identical || 0}</span></div>
                    <div className="flex justify-between"><span className="text-secondary">Conflicts:</span> <span className="text-amber-400 font-semibold">{summary?.episodes?.conflicts || 0}</span></div>
                  </div>
                </div>

                {/* Lists Card */}
                <div className="bg-surface-hover border border-border rounded-2xl p-5 space-y-2">
                  <div className="text-xs text-secondary font-semibold uppercase tracking-wider">Custom Lists</div>
                  <div className="text-3xl font-bold text-primary">{summary?.lists?.total || 0}</div>
                  <div className="text-xs space-y-1 pt-2 border-t border-border/60">
                    <div className="flex justify-between"><span className="text-secondary">New:</span> <span className="text-emerald-400 font-semibold">{summary?.lists?.new || 0}</span></div>
                    <div className="flex justify-between"><span className="text-secondary">Identical:</span> <span className="text-secondary font-semibold">{summary?.lists?.identical || 0}</span></div>
                    <div className="flex justify-between"><span className="text-secondary">Conflicts:</span> <span className="text-amber-400 font-semibold">{summary?.lists?.conflicts || 0}</span></div>
                  </div>
                </div>

                {/* Catalog Card */}
                <div className="bg-surface-hover border border-border rounded-2xl p-5 space-y-2">
                  <div className="text-xs text-secondary font-semibold uppercase tracking-wider">Catalog Metadata</div>
                  <div className="text-3xl font-bold text-primary">{summary?.catalog?.totalTitles || 0}</div>
                  <div className="text-xs space-y-1 pt-2 border-t border-border/60">
                    <div className="flex justify-between"><span className="text-secondary">Existing:</span> <span className="text-secondary font-semibold">{summary?.catalog?.existingTitles || 0}</span></div>
                    <div className="flex justify-between"><span className="text-secondary">New Snapshot:</span> <span className="text-emerald-400 font-semibold">{summary?.catalog?.newTitles || 0}</span></div>
                    <div className="flex justify-between"><span className="text-secondary">Seasons/Eps:</span> <span className="text-secondary font-semibold">{summary?.catalog?.seasons || 0}/{summary?.catalog?.episodes || 0}</span></div>
                  </div>
                </div>
              </div>

              {/* Conflict Inspector Toggle */}
              {conflicts.length > 0 && (
                <div className="bg-surface-hover border border-border rounded-2xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-bold font-display text-primary flex items-center gap-2">
                        <AlertTriangle size={18} className="text-amber-400" />
                        Detected Conflicts ({conflicts.length})
                      </h3>
                      <p className="text-secondary text-xs mt-1">
                        Inspect items where backup values differ from your current PostgreSQL data.
                      </p>
                    </div>
                    <button
                      onClick={() => setShowConflictInspector(!showConflictInspector)}
                      className="btn-secondary text-xs"
                    >
                      {showConflictInspector ? 'Hide Conflicts' : 'Inspect Conflicts'}
                    </button>
                  </div>

                  {showConflictInspector && (
                    <div className="space-y-3 pt-2 max-h-96 overflow-y-auto pr-2">
                      {conflicts.map((item, idx) => (
                        <div key={idx} className="p-3 bg-surface border border-border rounded-xl text-xs space-y-1.5">
                          <div className="flex items-center justify-between font-semibold text-primary">
                            <span>{item.displayTitle || item.titleKey}</span>
                            <span className="text-secondary uppercase text-[10px]">{item.type}</span>
                          </div>
                          {item.differences && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-secondary pt-1">
                              {Object.entries(item.differences).map(([field, diff]) => (
                                <div key={field} className="p-2 bg-surface-hover rounded border border-border/50">
                                  <span className="font-semibold text-primary block capitalize">{field}</span>
                                  <div>Existing: <span className="text-amber-300 font-mono">{String(diff.existing)}</span></div>
                                  <div>Imported: <span className="text-emerald-300 font-mono">{String(diff.imported)}</span></div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Conflict Strategy Selection */}
              <div className="bg-surface-hover border border-border rounded-2xl p-6 space-y-4">
                <h3 className="text-lg font-bold font-display text-primary">
                  Select Conflict Resolution Strategy
                </h3>
                <p className="text-secondary text-xs">
                  Choose how Strive handles items that already exist in your library.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <label
                    onClick={() => handleStrategyChange('MERGE')}
                    className={`cursor-pointer p-4 rounded-xl border transition-all flex flex-col justify-between ${
                      conflictStrategy === 'MERGE'
                        ? 'border-emerald-500/80 bg-emerald-950/20'
                        : 'border-border bg-surface hover:bg-surface-hover'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm text-primary flex items-center gap-2">
                        <span>Merge (Recommended)</span>
                      </div>
                      <p className="text-xs text-secondary mt-1 leading-relaxed">
                        Preserve existing ratings and notes. Apply missing watch statuses, episode states, and list items safely.
                      </p>
                    </div>
                  </label>

                  <label
                    onClick={() => handleStrategyChange('SKIP')}
                    className={`cursor-pointer p-4 rounded-xl border transition-all flex flex-col justify-between ${
                      conflictStrategy === 'SKIP'
                        ? 'border-blue-500/80 bg-blue-950/20'
                        : 'border-border bg-surface hover:bg-surface-hover'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm text-primary">Skip Conflicts</div>
                      <p className="text-xs text-secondary mt-1 leading-relaxed">
                        Import only new items. Leave all pre-existing library items and custom lists completely unchanged.
                      </p>
                    </div>
                  </label>

                  <label
                    onClick={() => handleStrategyChange('OVERWRITE')}
                    className={`cursor-pointer p-4 rounded-xl border transition-all flex flex-col justify-between ${
                      conflictStrategy === 'OVERWRITE'
                        ? 'border-amber-500/80 bg-amber-950/20'
                        : 'border-border bg-surface hover:bg-surface-hover'
                    }`}
                  >
                    <div>
                      <div className="font-bold text-sm text-amber-300">Overwrite Existing</div>
                      <p className="text-xs text-secondary mt-1 leading-relaxed">
                        Replace existing ratings, notes, and statuses with the values from this backup file.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Overwrite Warning Banner */}
                {showOverwriteWarning && (
                  <div className="p-4 bg-amber-950/50 border border-amber-700/60 rounded-xl text-xs text-amber-200 flex items-start gap-3">
                    <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold block text-sm">Warning: Overwrite Mode Selected</span>
                      Overwriting will replace your current ratings, custom notes, and watch statuses with the data from this backup payload.
                    </div>
                  </div>
                )}
              </div>

              {/* Start Import Action Button */}
              <div className="flex justify-center pt-4">
                <button
                  onClick={handleStartImport}
                  className="btn-primary px-10 py-3 text-base font-semibold"
                >
                  Start Import ({summary?.library?.total || 0} Items)
                </button>
              </div>
            </>
          )}

        </div>
      </main>
    </div>
  );
};

export default ImportReview;