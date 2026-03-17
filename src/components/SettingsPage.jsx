import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import {
  refreshLibraryMetadata,
  getMetadataStatistics,
  getItemsWithMissingMetadata,
  getLibraryByStatus,
} from "../util/firestoreService";
import {
  migrateUserData,
  checkMigrationNeeded,
} from "../util/migrationService";
import Header from "./Header";
import LibraryHealthPanel from "./LibraryHealthPanel";
import "../styles/SettingsPage.css";

const SettingsPage = () => {
  const isDev = import.meta.env.DEV;
  const { user } = useSelector((store) => store.user);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [migrationStatus, setMigrationStatus] = useState(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

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
        text: `✅ Refresh complete! Updated ${summary.refreshed} items in ${(summary.duration / 1000).toFixed(1)}s. ${summary.failed > 0 ? `(${summary.failed} failed)` : ""}`,
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
      setIsExporting(true);
      setMessage(null);

      // Fetch all items from library
      const watchlist = await getLibraryByStatus(user.uid, "plan_to_watch");
      const watched = await getLibraryByStatus(user.uid, "completed");

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
      setIsExporting(false);
    }
  };

  const handleMigrateData = async () => {
    if (!user?.uid || !migrationStatus?.needed) return;

    if (
      !window.confirm(
        `Migrate ${migrationStatus.totalToBeMigrated} items from old collections to new library format?\n\nThis is a one-time operation.`
      )
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
          text: `✅ Migration complete! Moved ${summary.watchlistMigrated} watchlist + ${summary.watchedMigrated} watched items to new library in ${(summary.durationMs / 1000).toFixed(1)}s.`,
        });
      } else {
        setMessage({
          type: "warning",
          text: `⚠️ Migration completed with errors. Check console for details. Migrated ${summary.watchlistMigrated + summary.watchedMigrated} items.`,
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

      <div className="pt-24 pb-12 px-10">
        <div className="max-w-full mx-auto">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div>
              <div className="flex items-center gap-4 mb-4">
                <div className="glass-effect p-4 rounded-full">
                  <span className="material-symbols-outlined text-5xl gradient-accent">
                    settings
                  </span>
                </div>
                <h1 className="font-display text-5xl lg:text-6xl font-bold gradient-text">
                  Settings
                </h1>
              </div>
              <p className="text-white/60 font-secondary text-lg">
                Manage metadata, backups, and migration tools
              </p>
            </div>
          </div>

          {message && (
            <div className={`message message-${message.type}`}>
              {message.text}
            </div>
          )}

          <div className="mt-8 space-y-6">
            {/* Metadata Statistics Section */}
            <section className="settings-section glass-effect">
              <h2>Library Metadata</h2>

              {loading ? (
                <div className="loading-state">Loading metadata statistics...</div>
              ) : metadata ? (
                <div className="metadata-stats">
                  <div className="stat-item">
                    <label>Total Items:</label>
                    <span>{metadata.totalItems}</span>
                  </div>
                  <div className="stat-item">
                    <label>Items with IMDb Data:</label>
                    <span className="stat-value-green">
                      {metadata.itemsWithMetadata}
                    </span>
                  </div>
                  <div className="stat-item">
                    <label>Items Missing Data:</label>
                    <span className="stat-value-orange">
                      {metadata.itemsWithoutMetadata}
                    </span>
                  </div>
                  <div className="stat-item">
                    <label>Data Completeness:</label>
                    <span className="stat-value-blue">{metadata.completeness}</span>
                  </div>
                  <div className="stat-item">
                    <label>Average IMDb Rating:</label>
                    <span>{metadata.averageImdbRating}</span>
                  </div>
                </div>
              ) : null}

              {/* Progress Bar */}
              {isRefreshing && refreshProgress && (
                <div className="progress-container">
                  <div className="progress-text">
                    Refreshing: {refreshProgress.current}/{refreshProgress.total}
                    {refreshProgress.itemTitle && (
                      <span className="progress-item-title">
                        - {refreshProgress.itemTitle}
                      </span>
                    )}
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{
                        width: `${
                          (refreshProgress.current / refreshProgress.total) * 100
                        }%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Refresh Buttons */}
              <div className="button-group">
                <button
                  className="btn btn-primary btn-refresh"
                  onClick={handleRefreshMetadata}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? (
                    <>
                      <span className="spinner" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <span className="icon">🔄</span>
                      Refresh Missing Metadata
                    </>
                  )}
                </button>

                <button
                  className="btn btn-secondary btn-force-refresh"
                  onClick={handleForceRefresh}
                  disabled={isRefreshing}
                  title="Force refresh all items (even those with existing data)"
                >
                  {isRefreshing ? (
                    <>
                      <span className="spinner" />
                      Force Refreshing...
                    </>
                  ) : (
                    <>
                      <span className="icon">⚡</span>
                      Force Refresh All
                    </>
                  )}
                </button>
              </div>

              <p className="help-text">
                <strong>Refresh Missing Metadata:</strong> Updates items that don't
                have IMDb ratings. Quick and safe Operation.
                <br />
                <strong>Force Refresh All:</strong> Re-fetches IMDb data for your
                entire library. Use this to update old ratings or fix corrupted
                data.
              </p>
            </section>

            {/* Data Migration Section - Only show if migration is needed */}
            {migrationStatus?.needed && (
              <section className="settings-section migration-warning glass-effect">
                <h2>⚠️ Data Migration Required</h2>
                <p>
                  We detected old library data in your account that hasn't been
                  migrated to the new format yet.
                </p>
                <div className="migration-details">
                  <div className="detail-item">
                    <span>Watchlist items to migrate:</span>
                    <strong>{migrationStatus.watchlistCount}</strong>
                  </div>
                  <div className="detail-item">
                    <span>Watched items to migrate:</span>
                    <strong>{migrationStatus.watchedCount}</strong>
                  </div>
                </div>
                <p className="help-text">
                  This migration will move your data to our improved library system.
                  It's a one-time operation and is completely safe.
                </p>
                <button
                  className="btn btn-primary btn-migrate"
                  onClick={handleMigrateData}
                  disabled={isMigrating}
                >
                  {isMigrating ? (
                    <>
                      <span className="spinner" />
                      Migrating...
                    </>
                  ) : (
                    <>
                      <span className="icon">📦</span>
                      Migrate Data Now
                    </>
                  )}
                </button>
              </section>
            )}

            {/* Dev Diagnostics */}
            {isDev && <LibraryHealthPanel userId={user?.uid} />}

            {/* Data Export Section */}
            <section className="settings-section glass-effect">
              <h2>📥 Backup & Export</h2>
              <p>
                Export your entire library to JSON format. This creates a portable
                backup of all your movies and shows.
              </p>
              <div className="export-info">
                <p className="info-item">
                  ✓ Includes watchlist and watched items
                </p>
                <p className="info-item">✓ Contains IMDb ratings and metadata</p>
                <p className="info-item">✓ Timestamped for easy organization</p>
                <p className="info-item">✓ Can be imported into other tools</p>
              </div>
              <button
                className="btn btn-secondary btn-export"
                onClick={handleExportLibrary}
                disabled={isExporting}
              >
                {isExporting ? (
                  <>
                    <span className="spinner" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <span className="icon">⬇️</span>
                    Download Library as JSON
                  </>
                )}
              </button>
            </section>

            <section className="settings-section glass-effect">
              <h2>About</h2>
              <p>Movie & TV Show Tracking App</p>
              <p>Version 1.0.0</p>
              <p>
                This app combines TMDB and IMDb data to provide comprehensive
                information about movies and TV shows.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
