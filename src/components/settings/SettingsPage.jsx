import React, { useMemo, useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { unparse } from "papaparse";
import {
  refreshLibraryMetadata,
  getMetadataStatistics,
  getLibraryByStatus,
} from "../../util/firebase/firestoreService";
import {
  migrateUserData,
  checkMigrationNeeded,
} from "../../util/firebase/migrationService";
import { downloadTemplateCsv } from "../../util/export/csvTemplate";
import Header from "../layout/Header";
import LibraryHealthPanel from "../library/LibraryHealthPanel";

const SettingsPage = () => {
  const isDev = import.meta.env.DEV;
  const { user } = useSelector((store) => store.user);
  const navigate = useNavigate();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [exportingFormat, setExportingFormat] = useState(null);

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

    const v = variants[message.type] || variants.info;
    return v;
  }, [message]);

  // Load metadata statistics on mount
  useEffect(() => {
    if (user?.uid) {
      loadMetadataStats();
      checkMigration();
    }
  }, [user?.uid]);

  const checkMigration = async () => {
    try {
      const status = await checkMigrationNeeded(user.uid);
      setMigrationStatus(status);
    } catch (error) {
      console.error("Error checking migration status:", error);
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

      // Reload statistics after refresh
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
        forceRefresh: true, // Force refresh ALL items
        onProgress: (progress) => {
          setRefreshProgress(progress);
        },
      });

      // Reload statistics after refresh
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

      // Fetch all items from library
      const [watchlist, watched] = await Promise.all([
        getLibraryByStatus(user.uid, "plan_to_watch", {
          hydrate: false,
          allowLegacyFallback: false,
        }),
        getLibraryByStatus(user.uid, "completed", {
          hydrate: false,
          allowLegacyFallback: false,
        }),
      ]);

      // Combine into export format
      const exportData = {
        exportDate: new Date().toISOString(),
        userId: user.uid,
        userEmail: user.email,
        summary: {
          totalItems: watchlist.length + watched.length,
          watchlistCount: watchlist.length,
          watchedCount: watched.length,
        },
        data: {
          watchlist: watchlist.map((item) => ({
            id: item.id,
            title: item.title || item.name,
            mediaType: item.media_type,
            year: (item.release_date || item.first_air_date)?.split("-")[0],
            tmdbRating: item.vote_average,
            imdbRating: item.imdbRating,
            imdbVotes: item.imdbVotes,
            dateAdded: item.dateAdded,
            url: `https://www.themoviedb.org/${
              item.media_type === "tv" ? "tv" : "movie"
            }/${item.id}`,
          })),
          watched: watched.map((item) => ({
            id: item.id,
            title: item.title || item.name,
            mediaType: item.media_type,
            year: (item.release_date || item.first_air_date)?.split("-")[0],
            tmdbRating: item.vote_average,
            imdbRating: item.imdbRating,
            imdbVotes: item.imdbVotes,
            dateAdded: item.dateAdded,
            dateWatched: item.dateWatched,
            url: `https://www.themoviedb.org/${
              item.media_type === "tv" ? "tv" : "movie"
            }/${item.id}`,
          })),
        },
      };

      // Create JSON blob
      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      // Trigger download
      const link = document.createElement("a");
      link.href = url;
      link.download = `movie-tracker-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage({
        type: "success",
        text: `✅ Library exported successfully! Downloaded file with ${exportData.summary.totalItems} items.`,
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

    const formatDate = (value) => {
      if (!value) return "";
      if (typeof value === "string") return value;
      if (value?.toDate && typeof value.toDate === "function") {
        try {
          return value.toDate().toISOString();
        } catch {
          return "";
        }
      }
      if (value instanceof Date) return value.toISOString();
      return "";
    };

    const extractYear = (value) => {
      if (!value) return "";
      const str = typeof value === "string" ? value : formatDate(value);
      return str?.split("-")[0] || "";
    };

    const formatNumber = (value, decimals = 1) => {
      if (value === null || value === undefined || value === "") return "";
      const num = Number(value);
      if (!Number.isFinite(num)) return "";
      return decimals === null ? String(num) : num.toFixed(decimals);
    };

    const formatInt = (value) => {
      if (value === null || value === undefined || value === "") return "";
      const num = Number(value);
      if (!Number.isFinite(num)) return "";
      return String(Math.trunc(num));
    };

    try {
      setExportingFormat("csv");
      setMessage(null);

      const [watchlist, watched] = await Promise.all([
        getLibraryByStatus(user.uid, "Plan to Watch", {
          hydrate: false,
          allowLegacyFallback: false,
        }),
        getLibraryByStatus(user.uid, "Completed", {
          hydrate: false,
          allowLegacyFallback: false,
        }),
      ]);

      const rows = [
        ...watchlist.map((item) => ({
          status: "Plan to Watch",
          title: item.title || item.name || "",
          mediaType: item.media_type || item.mediaType || "movie",
          year: extractYear(item.release_date || item.first_air_date),
          tmdbId: item.id || "",
          imdbId: item.imdbId || "",
          tmdbRating: formatNumber(item.vote_average, 1),
          tmdbVotes: formatInt(item.vote_count),
          imdbRating: formatNumber(item.imdbRating, 1),
          imdbVotes: formatInt(item.imdbVotes),
          dateAdded: formatDate(item.dateAdded),
          dateWatched: "",
          url: `https://www.themoviedb.org/${
            (item.media_type || item.mediaType) === "tv" ? "tv" : "movie"
          }/${item.id}`,
        })),
        ...watched.map((item) => ({
          status: "Completed",
          title: item.title || item.name || "",
          mediaType: item.media_type || item.mediaType || "movie",
          year: extractYear(item.release_date || item.first_air_date),
          tmdbId: item.id || "",
          imdbId: item.imdbId || "",
          tmdbRating: formatNumber(item.vote_average, 1),
          tmdbVotes: formatInt(item.vote_count),
          imdbRating: formatNumber(item.imdbRating, 1),
          imdbVotes: formatInt(item.imdbVotes),
          dateAdded: formatDate(item.dateAdded),
          dateWatched: formatDate(item.dateWatched || item.lastWatchedAt),
          url: `https://www.themoviedb.org/${
            (item.media_type || item.mediaType) === "tv" ? "tv" : "movie"
          }/${item.id}`,
        })),
      ];

      const columns = [
        "status",
        "title",
        "mediaType",
        "year",
        "tmdbId",
        "imdbId",
        "tmdbRating",
        "tmdbVotes",
        "imdbRating",
        "imdbVotes",
        "dateAdded",
        "dateWatched",
        "url",
      ];

      const csvString = unparse(rows, {
        columns,
        skipEmptyLines: true,
      });

      const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `movie-tracker-export-${new Date()
        .toISOString()
        .split("T")[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage({
        type: "success",
        text: `✅ Library exported to CSV! Downloaded file with ${rows.length} items.`,
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

  const handleMigrateData = async () => {
    if (!user?.uid) return;

    const pendingCount = migrationStatus?.totalToBeMigrated || 0;
    const confirmMessage = pendingCount > 0
      ? `Migrate ${pendingCount} items to the unified library format?\n\nThis includes watchlist, watched, and custom list entries.`
      : `No pending migration was detected.\n\nRun reconciliation anyway to ensure custom lists and library items are fully synchronized?`;

    if (
      !window.confirm(confirmMessage)
    ) {
      return;
    }

    try {
      setIsMigrating(true);
      setMessage(null);

      const summary = await migrateUserData(user.uid);

      // Reload library data after migration
      await loadMetadataStats();
      await checkMigration();

      if (summary.errors.length === 0) {
        setMessage({
          type: "success",
          text: `✅ Migration complete! Moved ${summary.watchlistMigrated} watchlist + ${summary.watchedMigrated} watched + ${summary.customListItemsMigrated} custom-list items into unified library in ${(summary.durationMs / 1000).toFixed(1)}s.`,
        });
      } else {
        setMessage({
          type: "warning",
          text: `⚠️ Migration completed with errors. Check console for details. Migrated ${summary.libraryItemsTouched} items.`,
        });
      }
    } catch (error) {
      console.error("Error migrating data:", error);
      setMessage({
        type: "error",
        text: `Failed to migrate data: ${error.message}`,
      });
    } finally {
      setIsMigrating(false);
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
              <p className="text-white/60 font-secondary text-lg">
                Manage metadata, imports/exports, and migration tools
              </p>
            </div>
          </div>

          {message && messageUi && (
            <div
              className={`mt-6 glass-effect rounded-2xl p-4 border ${messageUi.border} ${messageUi.bg}`}
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

          <div className="mt-8 space-y-6 max-w-6xl mx-auto">
            {/* Library Metadata */}
            <section className="glass-effect rounded-2xl p-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold font-display text-white flex items-center gap-3">
                    <span className="material-symbols-outlined text-3xl text-white/80">
                      database
                    </span>
                    Library Metadata
                  </h2>
                  <p className="text-white/60 text-sm font-secondary mt-1">
                    Stats + maintenance tools for ratings and vote counts.
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
                <div className="text-white/60 text-sm font-secondary mt-6 flex items-center gap-3">
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white" />
                  Loading metadata statistics...
                </div>
              ) : metadata ? (
                <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div
                    className="rounded-xl p-4 border"
                    style={{ backgroundColor: "var(--color-bg-elevated)", borderColor: "var(--color-border)" }}
                  >
                    <p className="text-white/60 text-xs font-secondary">Total Items</p>
                    <p className="text-2xl font-bold text-white mt-1">{metadata.totalItems}</p>
                  </div>
                  <div
                    className="rounded-xl p-4 border"
                    style={{ backgroundColor: "var(--color-bg-elevated)", borderColor: "var(--color-border)" }}
                  >
                    <p className="text-white/60 text-xs font-secondary">Items with IMDb Data</p>
                    <p className="text-2xl font-bold text-emerald-400 mt-1">
                      {metadata.itemsWithMetadata}
                    </p>
                  </div>
                  <div
                    className="rounded-xl p-4 border"
                    style={{ backgroundColor: "var(--color-bg-elevated)", borderColor: "var(--color-border)" }}
                  >
                    <p className="text-white/60 text-xs font-secondary">Items Missing Data</p>
                    <p className="text-2xl font-bold text-amber-400 mt-1">
                      {metadata.itemsWithoutMetadata}
                    </p>
                  </div>
                  <div
                    className="rounded-xl p-4 border"
                    style={{ backgroundColor: "var(--color-bg-elevated)", borderColor: "var(--color-border)" }}
                  >
                    <p className="text-white/60 text-xs font-secondary">Data Completeness</p>
                    <p className="text-2xl font-bold text-sky-400 mt-1">{metadata.completeness}</p>
                  </div>
                  <div
                    className="rounded-xl p-4 border sm:col-span-2 lg:col-span-1"
                    style={{ backgroundColor: "var(--color-bg-elevated)", borderColor: "var(--color-border)" }}
                  >
                    <p className="text-white/60 text-xs font-secondary">Average IMDb Rating</p>
                    <p
                      className="text-2xl font-bold mt-1"
                      style={{ color: "var(--color-accent-secondary)" }}
                    >
                      {metadata.averageImdbRating}
                    </p>
                  </div>
                </div>
              ) : null}

              {isRefreshing && refreshProgress && (
                <div
                  className="mt-6 rounded-xl p-4 border"
                  style={{ backgroundColor: "var(--color-bg-elevated)", borderColor: "var(--color-border)" }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-white/70">
                    <div>
                      Refreshing: {refreshProgress.current}/{refreshProgress.total}
                    </div>
                    {refreshProgress.itemTitle && (
                      <div className="text-white/60 italic truncate">
                        {refreshProgress.itemTitle}
                      </div>
                    )}
                  </div>
                  <div className="mt-3 h-2 w-full rounded-full overflow-hidden bg-white/10">
                    <div
                      className="h-full"
                      style={{
                        width: `${
                          refreshProgress.total > 0
                            ? Math.min(
                                100,
                                Math.round(
                                  (refreshProgress.current / refreshProgress.total) * 100
                                )
                              )
                            : 0
                        }%`,
                        background:
                          "linear-gradient(90deg, var(--color-accent-primary), var(--color-accent-secondary))",
                        transition: "width var(--transition-base)",
                      }}
                    />
                  </div>
                </div>
              )}

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

              <p className="text-white/60 text-sm leading-relaxed mt-5">
                <span className="text-white/80 font-semibold">Refresh Missing Metadata:</span>{" "}
                Updates items that don’t have IMDb ratings/votes (or TMDB vote counts) across your Library and
                Custom Lists.
                <br />
                <span className="text-white/80 font-semibold">Force Refresh All:</span>{" "}
                Re-fetches IMDb data for your entire library and custom list records (useful for stale ratings or
                repairs).
              </p>
            </section>

            {/* Data Migration */}
            <section
              className={`glass-effect rounded-2xl p-8 border ${
                migrationStatus?.needed ? "border-red-500/30" : "border-white/10"
              }`}
            >
              <h2 className="text-2xl font-bold font-display text-white flex items-center gap-3">
                <span className="material-symbols-outlined text-3xl text-white/80">
                  move_up
                </span>
                {migrationStatus?.needed
                  ? "Data Migration Required"
                  : "Data Migration & Reconciliation"}
              </h2>

              {migrationStatus?.error ? (
                <p className="text-red-400 text-sm font-secondary mt-3">
                  Migration scan failed: {migrationStatus.error}
                </p>
              ) : migrationStatus?.needed ? (
                <p className="text-white/70 text-sm font-secondary mt-3">
                  We detected library entries that still need migration into the unified format.
                </p>
              ) : (
                <p className="text-white/70 text-sm font-secondary mt-3">
                  No pending migration detected. You can still run reconciliation to ensure custom list items are
                  linked to unified library records.
                </p>
              )}

              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    label: "Watchlist to migrate",
                    value: migrationStatus?.watchlistCount || 0,
                  },
                  {
                    label: "Watched to migrate",
                    value: migrationStatus?.watchedCount || 0,
                  },
                  {
                    label: "Custom list items",
                    value: migrationStatus?.customListItemsNeedingMigration || 0,
                  },
                  {
                    label: "Total pending",
                    value: migrationStatus?.totalToBeMigrated || 0,
                  },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="rounded-xl p-4 border"
                    style={{ backgroundColor: "var(--color-bg-elevated)", borderColor: "var(--color-border)" }}
                  >
                    <p className="text-white/60 text-xs font-secondary">{s.label}</p>
                    <p
                      className="text-2xl font-bold mt-1"
                      style={{ color: "var(--color-accent-secondary)" }}
                    >
                      {s.value}
                    </p>
                  </div>
                ))}
              </div>

              <p className="text-white/60 text-sm leading-relaxed mt-5">
                This operation is idempotent and safe to re-run. It merges legacy watchlist/watched/custom-list
                records into unified library items and preserves existing metadata.
              </p>

              <div className="mt-6">
                <button
                  className={`${
                    migrationStatus?.needed ? "btn-primary" : "btn-secondary"
                  } flex items-center gap-2`}
                  onClick={handleMigrateData}
                  disabled={isMigrating || !user?.uid}
                >
                  {isMigrating ? (
                    <>
                      <span className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white" />
                      <span>Migrating...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined">sync_alt</span>
                      <span>
                        {migrationStatus?.needed ? "Migrate Data Now" : "Run Reconciliation"}
                      </span>
                    </>
                  )}
                </button>
              </div>
            </section>

            {/* Import & Export */}
            <section className="glass-effect rounded-2xl p-8">
              <h2 className="text-2xl font-bold font-display text-white flex items-center gap-3">
                <span className="material-symbols-outlined text-3xl text-white/80">
                  import_export
                </span>
                Import & Export
              </h2>
              <p className="text-white/70 text-sm font-secondary mt-2">
                Keep a portable backup, or import items via CSV.
              </p>

              <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div
                  className="rounded-2xl p-5 border"
                  style={{ backgroundColor: "var(--color-bg-elevated)", borderColor: "var(--color-border)" }}
                >
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <span className="material-symbols-outlined">download</span>
                    Export Library
                  </h3>
                  <p className="text-white/60 text-sm mt-2">
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

                  <div className="mt-4 text-white/60 text-sm space-y-1">
                    <div>✓ Includes watchlist + watched</div>
                    <div>✓ Includes IMDb + TMDB ratings/votes</div>
                    <div>✓ Timestamped filenames</div>
                  </div>
                </div>

                <div
                  className="rounded-2xl p-5 border"
                  style={{ backgroundColor: "var(--color-bg-elevated)", borderColor: "var(--color-border)" }}
                >
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <span className="material-symbols-outlined">upload</span>
                    Import Library
                  </h3>
                  <p className="text-white/60 text-sm mt-2">
                    Import items into your library using the supported CSV format.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      className="btn-primary flex items-center gap-2"
                      onClick={() => navigate("/import")}
                    >
                      <span className="material-symbols-outlined">upload</span>
                      <span>Import CSV</span>
                    </button>
                    <button
                      className="btn-secondary flex items-center gap-2"
                      onClick={downloadTemplateCsv}
                      title="Download a CSV template with correct headers"
                    >
                      <span className="material-symbols-outlined">file_download</span>
                      <span>Download Template</span>
                    </button>
                  </div>

                  <p className="text-white/50 text-xs leading-relaxed mt-4">
                    Tip: For custom list CSV exports, use the export button from a specific list.
                  </p>
                </div>
              </div>
            </section>

            {/* Dev Diagnostics */}
            {isDev && <LibraryHealthPanel userId={user?.uid} />}

            {/* About */}
            <section className="glass-effect rounded-2xl p-8">
              <h2 className="text-2xl font-bold font-display text-white flex items-center gap-3">
                <span className="material-symbols-outlined text-3xl text-white/80">
                  info
                </span>
                About
              </h2>
              <div className="mt-3 text-white/70 text-sm leading-relaxed">
                <div className="text-white font-semibold">Movie & TV Show Tracking App</div>
                <div className="text-white/50">Version 1.0.0</div>
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
