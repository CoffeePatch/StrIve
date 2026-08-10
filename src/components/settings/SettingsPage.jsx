import React, { useMemo, useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import {
  refreshLibraryMetadata,
  getMetadataStatistics,
} from "../../services/metadataService";
import { downloadTemplateCsv } from "../../util/export/csvTemplate";
import Header from "../layout/Header";
import LibraryHealthPanel from "../library/LibraryHealthPanel";
import { useTheme } from "../../contexts/ThemeContext";
import simklAuthService from "../../services/simkl/simklAuthService";
import { getAllLibraryItems } from "../../services/libraryService";
import { buildSimklPayloads, createSimklBatches, executeSimklSync } from "../../domain/simkl/simklSyncController";
import { executeSimklImportAnalysis } from "../../domain/simkl/simklImportAnalyzer";
import { executeSimklImportConfirmation } from "../../domain/simkl/simklImportConfirmController";

const SettingsPage = () => {
  const { theme, setTheme } = useTheme();
  const isDev = import.meta.env.DEV;
  const { user } = useSelector((store) => store.user);
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [exportingFormat, setExportingFormat] = useState(null);
  const [simklStatus, setSimklStatus] = useState({ connected: false, simklUserId: null, connectedAt: null });
  const [simklLoading, setSimklLoading] = useState(false);

  const messageUi = useMemo(() => {
    if (!message) return null;

    const variants = {
      success: {
        border: "border-emerald-500/40",
        bg: "bg-emerald-500/10",
        text: "text-emerald-200",
        icon: "check_circle",
      },
      error: {
        border: "border-red-500/40",
        bg: "bg-red-500/10",
        text: "text-red-200",
        icon: "error",
      },
      warning: {
        border: "border-amber-500/40",
        bg: "bg-amber-500/10",
        text: "text-amber-200",
        icon: "warning",
      },
      info: {
        border: "border-blue-500/40",
        bg: "bg-blue-500/10",
        text: "text-blue-200",
        icon: "info",
      },
    };

    return variants[message.type] || variants.info;
  }, [message]);

  useEffect(() => {
    if (user?.uid) {
      loadMetadataStats();
      loadSimklStatus();
    }
  }, [user?.uid]);

  const loadSimklStatus = async () => {
    try {
      const status = await simklAuthService.getStatus();
      setSimklStatus(status);
    } catch (err) {
      console.warn("Failed to load Simkl status:", err);
    }
  };

  const handleConnectSimkl = async () => {
    try {
      setSimklLoading(true);
      await simklAuthService.initiateAuth();
    } catch (err) {
      setMessage({
        type: "error",
        text: `Simkl connection failed: ${err.message}`,
      });
      setSimklLoading(false);
    }
  };

  const handleDisconnectSimkl = async () => {
    try {
      setSimklLoading(true);
      const res = await simklAuthService.disconnect();
      if (res.success) {
        setSimklStatus({ connected: false, simklUserId: null, connectedAt: null });
        setMessage({
          type: "success",
          text: "✅ Simkl account disconnected successfully.",
        });
      } else {
        throw new Error(res.error || "Disconnect failed");
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: `Failed to disconnect Simkl: ${err.message}`,
      });
    } finally {
      setSimklLoading(false);
    }
  };

  const [syncingSimkl, setSyncingSimkl] = useState(false);
  const [simklSyncProgress, setSimklSyncProgress] = useState(null);

  const handleSyncSimkl = async () => {
    if (!user?.uid) return;
    try {
      setSyncingSimkl(true);
      setSimklSyncProgress({ percent: 0, currentBatch: 0, totalBatches: 0, processed: 0 });
      setMessage(null);

      const items = await getAllLibraryItems(user.uid, { hydrate: false });

      if (items.length === 0) {
        setMessage({
          type: "info",
          text: "No library items found in PostgreSQL to push to Simkl.",
        });
        return;
      }

      const payloads = buildSimklPayloads(items, []);
      const historyBatches = createSimklBatches(payloads.history, "history");
      const ratingBatches = createSimklBatches(payloads.ratings, "ratings");
      const allBatches = [...historyBatches, ...ratingBatches];

      if (allBatches.length === 0) {
        setMessage({
          type: "info",
          text: "No eligible watched or rated items found to push to Simkl.",
        });
        return;
      }

      const syncResult = await executeSimklSync(allBatches, {
        onProgress: (progress) => setSimklSyncProgress(progress),
      });

      if (syncResult.success) {
        setMessage({
          type: "success",
          text: `✅ Successfully pushed ${syncResult.processed} items to Simkl across ${syncResult.totalBatches} batches!`,
        });
      }
    } catch (err) {
      console.error("Simkl sync failed:", err);
      setMessage({
        type: "error",
        text: `Simkl synchronization error: ${err.message}`,
      });
    } finally {
      setSyncingSimkl(false);
      setSimklSyncProgress(null);
    }
  };

  const [analyzingSimkl, setAnalyzingSimkl] = useState(false);
  const [simklAnalysisResult, setSimklAnalysisResult] = useState(null);

  const handleAnalyzeSimklImport = async () => {
    if (!user?.uid) return;
    try {
      setAnalyzingSimkl(true);
      setSimklAnalysisResult(null);
      setMessage(null);

      const result = await executeSimklImportAnalysis();
      if (result.success) {
        setSimklAnalysisResult(result);
        setMessage({
          type: "info",
          text: `ℹ️ Analysis complete: Previewing changes for ${result.summary.simklItems} Simkl items. (Read-Only)`,
        });
      }
    } catch (err) {
      console.error("Simkl import analysis failed:", err);
      setMessage({
        type: "error",
        text: `Simkl import analysis error: ${err.message}`,
      });
    } finally {
      setAnalyzingSimkl(false);
    }
  };

  const [confirmingSimkl, setConfirmingSimkl] = useState(false);

  const handleConfirmSimklImport = async () => {
    if (!user?.uid || !simklAnalysisResult?.diffs) return;
    try {
      setConfirmingSimkl(true);
      setMessage(null);

      const actionableChanges = simklAnalysisResult.diffs.filter(d => 
        d.changeType === "SIMKL_ONLY" || 
        d.changeType === "WATCH_STATUS_DIFFERENCE" || 
        d.changeType === "RATING_DIFFERENCE" || 
        d.changeType === "WATCH_AND_RATING_DIFFERENCE"
      ).map(d => ({
        titleKey: d.titleKey,
        mediaType: d.type || "movie",
        tmdbId: d.tmdbId,
        imdbId: d.imdbId,
        title: d.title,
        importStatus: d.simklStatus || d.proposedStatus || "completed",
        importRating: d.simklRating || d.proposedRating || null,
        selectedFields: ["status", "rating"],
        striveStatus: d.striveStatus,
        striveRating: d.striveRating,
      }));

      if (actionableChanges.length === 0) {
        setMessage({
          type: "info",
          text: "No actionable differences selected for confirmation.",
        });
        return;
      }

      const confirmResult = await executeSimklImportConfirmation(actionableChanges);
      if (confirmResult.success) {
        setMessage({
          type: "success",
          text: `✅ Simkl Import Confirmed! Successfully imported ${confirmResult.summary.imported} items to Strive PostgreSQL (${confirmResult.summary.stale} stale skipped).`,
        });
        setSimklAnalysisResult(null);
      }
    } catch (err) {
      console.error("Simkl import confirmation failed:", err);
      setMessage({
        type: "error",
        text: `Simkl import confirmation error: ${err.message}`,
      });
    } finally {
      setConfirmingSimkl(false);
    }
  };

  const loadMetadataStats = async () => {
    try {
      setLoading(true);
      const stats = await getMetadataStatistics(user.uid);
      setMetadata(stats);
    } catch (error) {
      console.error("Error loading metadata stats:", error);
      setMessage({
        type: "error",
        text: "Failed to load metadata statistics",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshMetadata = async () => {
    if (!user?.uid) return;

    try {
      setIsRefreshing(true);
      setRefreshProgress({ current: 0, total: 0 });
      setMessage(null);

      const summary = await refreshLibraryMetadata(user.uid, {
        batchSize: 100,
        forceRefresh: false,
        onProgress: (progress) => {
          setRefreshProgress(progress);
        },
      });

      await loadMetadataStats();

      setMessage({
        type: "success",
        text: `✅ Backfill complete! Updated ${summary.refreshed} items in ${(summary.duration / 1000).toFixed(1)}s (Library: ${summary.bySource?.library_items || 0}, Legacy: ${summary.bySource?.library || 0}, Custom Lists: ${summary.bySource?.custom_list_items || 0}). ${summary.failed > 0 ? `(${summary.failed} failed)` : ""}`,
      });
    } catch (error) {
      console.error("Error refreshing metadata:", error);
      setMessage({
        type: "error",
        text: `Failed to refresh metadata: ${error.message}`,
      });
    } finally {
      setIsRefreshing(false);
      setRefreshProgress(null);
    }
  };

  const handleForceRefresh = async () => {
    if (!user?.uid) return;

    try {
      setIsRefreshing(true);
      setRefreshProgress({ current: 0, total: 0 });
      setMessage(null);

      const summary = await refreshLibraryMetadata(user.uid, {
        batchSize: 100,
        forceRefresh: true,
        onProgress: (progress) => {
          setRefreshProgress(progress);
        },
      });

      await loadMetadataStats();

      setMessage({
        type: "success",
        text: `✅ Force refresh complete! Updated ${summary.refreshed} items in ${(summary.duration / 1000).toFixed(1)}s.`,
      });
    } catch (error) {
      console.error("Error force refreshing metadata:", error);
      setMessage({
        type: "error",
        text: `Failed to force refresh: ${error.message}`,
      });
    } finally {
      setIsRefreshing(false);
      setRefreshProgress(null);
    }
  };

  const handleExportLibrary = async () => {
    if (!user?.uid) return;

    try {
      setExportingFormat("json");
      setMessage(null);

      const token = await user.getIdToken();
      const response = await fetch("/api/user/export?format=json", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `HTTP ${response.status} Export Failed`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `strive-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage({
        type: "success",
        text: `✅ Library backup JSON exported successfully!`,
      });
    } catch (error) {
      console.error("Error exporting library:", error);
      setMessage({
        type: "error",
        text: `Failed to export library: ${error.message}`,
      });
    } finally {
      setExportingFormat(null);
    }
  };

  const handleExportLibraryCsv = async () => {
    if (!user?.uid) return;

    try {
      setExportingFormat("csv");
      setMessage(null);

      const token = await user.getIdToken();
      const response = await fetch("/api/user/export?format=csv", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `HTTP ${response.status} CSV Export Failed`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `strive-library-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage({
        type: "success",
        text: `✅ Library exported to CSV successfully!`,
      });
    } catch (error) {
      console.error("Error exporting library CSV:", error);
      setMessage({
        type: "error",
        text: `Failed to export CSV: ${error.message}`,
      });
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <div className="min-h-screen premium-page flex flex-col">
      <Header />

      <div className="pt-24 pb-12">
        <div className="premium-container">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <span className="material-symbols-outlined text-6xl gradient-accent leading-none shrink-0">
                  settings
                </span>
                <h1 className="font-display text-5xl lg:text-6xl font-bold gradient-text">
                  Settings
                </h1>
              </div>
              <p className="text-secondary font-secondary text-lg">
                Manage metadata, imports/exports, and library maintenance
              </p>
            </div>
          </div>

          {message && messageUi && (
            <div
              className={`mt-6 bg-surface rounded-2xl p-4 border ${messageUi.border} ${messageUi.bg}`}
              role="status"
            >
              <div className="flex items-start gap-3">
                <span className={`material-symbols-outlined ${messageUi.text}`}>
                  {messageUi.icon}
                </span>
                <div className={`${messageUi.text} text-sm leading-relaxed`}>{message.text}</div>
              </div>
            </div>
          )}

          {refreshProgress && isRefreshing && (
            <div className="mt-6 bg-surface rounded-2xl p-4 border border-border">
              <div className="flex items-center justify-between text-sm text-secondary mb-2">
                <span>Refreshing metadata...</span>
                <span>
                  {refreshProgress.current || 0}/{refreshProgress.total || 0}
                </span>
              </div>
              <div className="h-2 rounded-full bg-surface-hover overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-emerald-400 transition-all"
                  style={{
                    width:
                      refreshProgress.total > 0
                        ? `${Math.round((refreshProgress.current / refreshProgress.total) * 100)}%`
                        : "0%",
                  }}
                />
              </div>
            </div>
          )}

          <div className="mt-8 space-y-6 max-w-6xl mx-auto">
            <section className="bg-surface border border-border rounded-2xl p-8">
              <h2 className="text-2xl font-bold font-display text-[var(--theme-text-primary)] flex items-center gap-3">
                <span className="material-symbols-outlined text-3xl text-[var(--theme-text-secondary)]">
                  palette
                </span>
                Appearance
              </h2>
              <p className="text-[var(--theme-text-secondary)] text-sm font-secondary mt-2">
                Customize the application theme.
              </p>

              <div className="mt-6 flex flex-wrap gap-4">
                <label className={`cursor-pointer rounded-xl border p-4 flex flex-col items-center gap-2 transition-all ${theme === 'dark' ? 'border-[var(--theme-accent)] bg-[var(--theme-focus)]' : 'border-[var(--theme-border)] bg-[var(--theme-surface)] hover:bg-[var(--theme-surface-hover)]'}`} onClick={() => setTheme('dark')}>
                  <span className="material-symbols-outlined text-3xl text-[var(--theme-text-primary)]">dark_mode</span>
                  <span className="font-semibold text-[var(--theme-text-primary)]">Dark</span>
                </label>

                <label className={`cursor-pointer rounded-xl border p-4 flex flex-col items-center gap-2 transition-all ${theme === 'light' ? 'border-[var(--theme-accent)] bg-[var(--theme-focus)]' : 'border-[var(--theme-border)] bg-[var(--theme-surface)] hover:bg-[var(--theme-surface-hover)]'}`} onClick={() => setTheme('light')}>
                  <span className="material-symbols-outlined text-3xl text-[var(--theme-text-primary)]">light_mode</span>
                  <span className="font-semibold text-[var(--theme-text-primary)]">Light</span>
                </label>
                
                {/* Hidden system theme logic can be added later if needed */}
              </div>
            </section>

            <section className="bg-surface border border-border rounded-2xl p-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold font-display text-primary flex items-center gap-3">
                    <span className="material-symbols-outlined text-3xl text-secondary">
                      database
                    </span>
                    Library Metadata
                  </h2>
                  <p className="text-secondary text-sm font-secondary mt-1">
                    Stats and maintenance tools for ratings and vote counts.
                  </p>
                </div>

                <button
                  className="btn-secondary flex items-center gap-2"
                  onClick={loadMetadataStats}
                  disabled={!user?.uid || loading || isRefreshing}
                  title="Reload metadata statistics"
                >
                  <span className="material-symbols-outlined">refresh</span>
                  <span>Reload Stats</span>
                </button>
              </div>

              {loading ? (
                <div className="text-secondary text-sm font-secondary mt-6 flex items-center gap-3">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-border border-t-primary" />
                </div>
              ) : metadata ? (
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-xl p-4 border bg-surface-hover border-border">
                    <p className="text-secondary text-xs font-secondary">Library items</p>
                    <p className="text-2xl font-bold mt-1 text-accent-secondary">
                      {metadata.libraryItems || 0}
                    </p>
                  </div>
                  <div className="rounded-xl p-4 border bg-surface-hover border-border">
                    <p className="text-secondary text-xs font-secondary">Watchlist</p>
                    <p className="text-2xl font-bold mt-1 text-accent-secondary">
                      {metadata.watchlist || 0}
                    </p>
                  </div>
                  <div className="rounded-xl p-4 border bg-surface-hover border-border">
                    <p className="text-secondary text-xs font-secondary">Completed</p>
                    <p className="text-2xl font-bold mt-1 text-accent-secondary">
                      {metadata.completed || 0}
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  className="btn-secondary flex items-center gap-2"
                  onClick={handleRefreshMetadata}
                  disabled={isRefreshing || !user?.uid}
                >
                  {isRefreshing ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white" />
                      <span>Refreshing...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined">sync</span>
                      <span>Refresh Missing Metadata</span>
                    </>
                  )}
                </button>

                <button
                  className="btn-primary flex items-center gap-2"
                  onClick={handleForceRefresh}
                  disabled={isRefreshing || !user?.uid}
                  title="Force refresh all items (even those with existing data)"
                >
                  {isRefreshing ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white" />
                      <span>Force Refreshing...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined">bolt</span>
                      <span>Force Refresh All</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-secondary text-sm leading-relaxed mt-5">
                <span className="text-primary font-semibold">Refresh Missing Metadata:</span>{" "}
                Updates items that do not have IMDb ratings, votes, or TMDB vote counts across your library.
                <br />
                <span className="text-primary font-semibold">Force Refresh All:</span>{" "}
                Re-fetches IMDb data for your entire library and can be used for stale ratings or repairs.
              </p>
            </section>

            <section className="bg-surface border border-border rounded-2xl p-8">
              <h2 className="text-2xl font-bold font-display text-primary flex items-center gap-3">
                <span className="material-symbols-outlined text-3xl text-secondary">
                  import_export
                </span>
                Import & Export
              </h2>
              <p className="text-secondary text-sm font-secondary mt-2">
                Keep a portable backup, or import items via CSV.
              </p>

              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div
                  className="rounded-2xl p-5 border bg-surface-hover border-border"
                >
                  <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                    <span className="material-symbols-outlined">download</span>
                    Export Library
                  </h3>
                  <p className="text-secondary text-sm mt-2">
                    Exports your unified Library (watchlist + watched) with ratings and metadata.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      className="btn-secondary flex items-center gap-2"
                      onClick={handleExportLibrary}
                      disabled={!!exportingFormat}
                    >
                      {exportingFormat === "json" ? (
                        <>
                          <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white" />
                          <span>Exporting JSON...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined">description</span>
                          <span>Download JSON</span>
                        </>
                      )}
                    </button>

                    <button
                      className="btn-secondary flex items-center gap-2"
                      onClick={handleExportLibraryCsv}
                      disabled={!!exportingFormat}
                      title="CSV export is ideal for spreadsheets"
                    >
                      {exportingFormat === "csv" ? (
                        <>
                          <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white" />
                          <span>Exporting CSV...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined">table</span>
                          <span>Download CSV</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="mt-4 text-secondary text-sm space-y-1">
                    <div>✓ Includes watchlist + watched</div>
                    <div>✓ Includes IMDb + TMDB ratings/votes</div>
                    <div>✓ Timestamped filenames</div>
                  </div>
                </div>

                <div
                  className="rounded-2xl p-5 border bg-surface-hover border-border"
                >
                  <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                    <span className="material-symbols-outlined">upload</span>
                    Import Library
                  </h3>
                  <p className="text-secondary text-sm mt-2">
                    Import items into your library using Strive Backup JSON (v1) or CSV format.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      className="btn-primary flex items-center gap-2"
                      onClick={() => navigate("/import")}
                    >
                      <span className="material-symbols-outlined">upload</span>
                      <span>Import Backup / CSV</span>
                    </button>
                    <button
                      className="btn-secondary flex items-center gap-2"
                      onClick={downloadTemplateCsv}
                      title="Download a CSV template with correct headers"
                    >
                      <span className="material-symbols-outlined">file_download</span>
                      <span>Download CSV Template</span>
                    </button>
                  </div>

                  <p className="text-muted text-xs leading-relaxed mt-4">
                    Tip: For custom list CSV exports, use the export button from a specific list.
                  </p>
                </div>
              </div>
            </section>

            <section className="bg-surface border border-border rounded-2xl p-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold font-display text-primary flex items-center gap-3">
                    <span className="material-symbols-outlined text-3xl text-secondary">
                      sync
                    </span>
                    Simkl Integration
                  </h2>
                  <p className="text-secondary text-sm font-secondary mt-1">
                    Connect your Simkl account for optional media tracking backups.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {simklStatus.connected ? (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">check_circle</span>
                      Connected
                    </span>
                  ) : (
                    <span className="px-3 py-1 rounded-full text-xs font-semibold bg-surface-hover text-secondary border border-border">
                      Not Connected
                    </span>
                  )}
                </div>
              </div>

              {simklStatus.connected ? (
                <div className="mt-5 space-y-4">
                  <div className="p-4 rounded-xl border bg-surface-hover border-border text-sm space-y-1">
                    <div className="text-primary font-medium flex items-center gap-2">
                      <span className="material-symbols-outlined text-emerald-400">account_circle</span>
                      <span>Connected Account: {simklStatus.simklUserId || "Simkl User"}</span>
                    </div>
                    {simklStatus.connectedAt && (
                      <div className="text-muted text-xs">
                        Connected on {new Date(simklStatus.connectedAt).toLocaleDateString()}
                      </div>
                    )}
                  </div>

                  {simklSyncProgress && syncingSimkl && (
                    <div className="p-4 rounded-xl border border-border bg-surface">
                      <div className="flex items-center justify-between text-xs text-secondary mb-1">
                        <span>Syncing Batch {simklSyncProgress.currentBatch} of {simklSyncProgress.totalBatches}...</span>
                        <span>{simklSyncProgress.processed} items</span>
                      </div>
                      <div className="h-2 rounded-full bg-surface-hover overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all"
                          style={{ width: `${simklSyncProgress.percent || 0}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {simklAnalysisResult && (
                    <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/10 text-sm space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-base">visibility</span>
                          Simkl Import Preview (Read-Only)
                        </span>
                        <span className="text-xs text-muted">No Strive data modified</span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                        <div className="p-2 rounded-lg bg-surface/50 border border-border">
                          <div className="text-muted">Total Simkl</div>
                          <div className="text-base font-bold text-primary">{simklAnalysisResult.summary.simklItems}</div>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                          <div>Matched</div>
                          <div className="text-base font-bold">{simklAnalysisResult.summary.matched}</div>
                        </div>
                        <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400">
                          <div>Simkl Only</div>
                          <div className="text-base font-bold">{simklAnalysisResult.summary.simklOnly}</div>
                        </div>
                        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
                          <div>Differences</div>
                          <div className="text-base font-bold">
                            {simklAnalysisResult.summary.watchDifferences + simklAnalysisResult.summary.ratingDifferences}
                          </div>
                        </div>
                        <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30 text-purple-400">
                          <div>Unmatched</div>
                          <div className="text-base font-bold">{simklAnalysisResult.summary.unmatched}</div>
                        </div>
                      </div>

                      <div className="pt-2 flex justify-end">
                        <button
                          className="btn-primary bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-2 text-xs py-2 px-4"
                          onClick={handleConfirmSimklImport}
                          disabled={confirmingSimkl || syncingSimkl || simklLoading || analyzingSimkl}
                        >
                          {confirmingSimkl ? (
                            <>
                              <span className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white/20 border-t-white" />
                              <span>Importing to Strive PostgreSQL...</span>
                            </>
                          ) : (
                            <>
                              <span className="material-symbols-outlined text-sm">check_circle</span>
                              <span>Confirm Import to Strive</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <button
                      className="btn-primary flex items-center gap-2"
                      onClick={handleSyncSimkl}
                      disabled={syncingSimkl || simklLoading || analyzingSimkl}
                    >
                      {syncingSimkl ? (
                        <>
                          <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white" />
                          <span>Pushing to Simkl...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined">cloud_upload</span>
                          <span>Push Watch History & Ratings</span>
                        </>
                      )}
                    </button>

                    <button
                      className="btn-secondary flex items-center gap-2"
                      onClick={handleAnalyzeSimklImport}
                      disabled={syncingSimkl || simklLoading || analyzingSimkl}
                    >
                      {analyzingSimkl ? (
                        <>
                          <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white" />
                          <span>Analyzing Simkl...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined">analytics</span>
                          <span>Analyze Simkl Import (Preview)</span>
                        </>
                      )}
                    </button>

                    <button
                      className="btn-secondary text-red-400 hover:text-red-300 border-red-500/30 hover:bg-red-500/10 flex items-center gap-2"
                      onClick={handleDisconnectSimkl}
                      disabled={syncingSimkl || simklLoading || analyzingSimkl}
                    >
                      {simklLoading ? (
                        <>
                          <span className="animate-spin rounded-full h-4 w-4 border-2 border-red-400/20 border-t-red-400" />
                          <span>Disconnecting...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined">link_off</span>
                          <span>Disconnect Simkl</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  <p className="text-secondary text-sm leading-relaxed">
                    Connecting Simkl allows Strive to push your watch history and ratings as an optional backup.
                    Strive PostgreSQL remains your primary system of record.
                  </p>

                  <div className="flex flex-wrap gap-3">
                    <button
                      className="btn-primary flex items-center gap-2"
                      onClick={handleConnectSimkl}
                      disabled={simklLoading}
                    >
                      {simklLoading ? (
                        <>
                          <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white" />
                          <span>Connecting...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined">link</span>
                          <span>Connect Simkl Account</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </section>

            {isDev && <LibraryHealthPanel userId={user?.uid} />}

            <section className="bg-surface border border-border rounded-2xl p-8">
              <h2 className="text-2xl font-bold font-display text-primary flex items-center gap-3">
                <span className="material-symbols-outlined text-3xl text-secondary">
                  info
                </span>
                About
              </h2>
              <div className="mt-3 text-secondary text-sm leading-relaxed">
                <div className="text-primary font-semibold">Movie & TV Show Tracking App</div>
                <div className="text-muted">Version 1.0.0</div>
                <div className="mt-2">
                  This app combines TMDB and IMDb data to provide comprehensive information about movies and TV
                  shows.
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
