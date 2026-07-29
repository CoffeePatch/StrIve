import React, { useMemo, useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { unparse } from "papaparse";
import {
  refreshLibraryMetadata,
  getMetadataStatistics,
  getLibraryByStatus,
} from "../../util/firebase/firestoreService";
import { downloadTemplateCsv } from "../../util/export/csvTemplate";
import Header from "../layout/Header";
import LibraryHealthPanel from "../library/LibraryHealthPanel";
import { useTheme } from "../../contexts/ThemeContext";

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
    }
  }, [user?.uid]);

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

      const [watchlist, watched] = await Promise.all([
        getLibraryByStatus(user.uid, "plan_to_watch", {
          hydrate: false,
        }),
        getLibraryByStatus(user.uid, "completed", {
          hydrate: false,
        }),
      ]);

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

      const jsonString = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);

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
        getLibraryByStatus(user.uid, "plan_to_watch", {
          hydrate: false,
        }),
        getLibraryByStatus(user.uid, "completed", {
          hydrate: false,
        }),
      ]);

      const rows = [
        ...watchlist.map((item) => ({
          status: "Plan to Watch",
          title: item.title || item.name || "",
          mediaType: item.media_type || item.mediaType || "movie",
          year: extractYear(item.release_date || item.first_air_date || item.releaseDate),
          tmdbId: item.id || item.tmdbId || "",
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
          year: extractYear(item.release_date || item.first_air_date || item.releaseDate),
          tmdbId: item.id || item.tmdbId || "",
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
      link.download = `movie-tracker-export-${new Date().toISOString().split("T")[0]}.csv`;
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

                  <p className="text-muted text-xs leading-relaxed mt-4">
                    Tip: For custom list CSV exports, use the export button from a specific list.
                  </p>
                </div>
              </div>
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
