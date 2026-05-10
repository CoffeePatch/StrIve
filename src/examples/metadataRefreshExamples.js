/**
 * Phase 2: Enrichment Bridge - Metadata Refresh Examples
 * 
 * This file demonstrates how to use the new metadata refresh utilities
 * for ensuring IMDb data quality and keeping library ratings up-to-date.
 */

import {
  refreshLibraryMetadata,
  refreshCustomListMetadata,
  getItemsWithMissingMetadata,
  getMetadataStatistics,
} from '../util/firebase/firestoreService';

// =============================================================================
// EXAMPLE 1: Basic Metadata Refresh (Settings Page)
// =============================================================================

/**
 * Simple refresh that updates items without IMDb ratings
 * This is what the Settings button uses
 */
export const refreshMissingImdbDataExample = async (userId) => {
  try {
    console.log('🔄 Starting metadata refresh...');

    const summary = await refreshLibraryMetadata(userId, {
      batchSize: 50,
      forceRefresh: false, // Only refresh items with null ratings
      onProgress: (progress) => {
        console.log(
          `Progress: ${progress.current}/${progress.total} - ${progress.itemTitle}`
        );
      },
    });

    console.log('✅ Refresh complete!');
    console.log(`   - Total items in library: ${summary.totalItems}`);
    console.log(`   - Items refreshed: ${summary.refreshed}`);
    console.log(`   - Items failed: ${summary.failed}`);
    console.log(`   - Duration: ${(summary.duration / 1000).toFixed(2)}s`);

    if (summary.errors.length > 0) {
      console.warn('Failed items:', summary.errors);
    }

    return summary;
  } catch (error) {
    console.error('Error refreshing metadata:', error);
    throw error;
  }
};

// =============================================================================
// EXAMPLE 2: Force Refresh Entire Library (Admin)
// =============================================================================

/**
 * Force refresh ALL items, including those with existing ratings
 * Use this to update outdated or corrupted data
 */
export const forceRefreshAllMetadataExample = async (userId) => {
  try {
    console.log('⚡ Starting force refresh of entire library...');

    const summary = await refreshLibraryMetadata(userId, {
      batchSize: 100,
      forceRefresh: true, // Refresh ALL items regardless of existing data
      onProgress: (progress) => {
        const percentage = ((progress.current / progress.total) * 100).toFixed(
          0
        );
        console.log(
          `[${percentage}%] ${progress.current}/${progress.total} - ${progress.itemTitle}`
        );
      },
    });

    console.log('\n✅ Force refresh complete!');
    console.log(`   - Items processed: ${summary.refreshed + summary.failed}`);
    console.log(`   - Successfully updated: ${summary.refreshed}`);
    console.log(`   - Failed: ${summary.failed}`);

    return summary;
  } catch (error) {
    console.error('Error in force refresh:', error);
    throw error;
  }
};

// =============================================================================
// EXAMPLE 3: Refresh Custom List Only
// =============================================================================

/**
 * Refresh metadata only for items in a specific custom list
 * Useful for curated collections like "Favorites" or "To Watch"
 */
export const refreshCustomListMetadataExample = async (userId, listId) => {
  try {
    console.log(`🎬 Refreshing metadata for list: ${listId}`);

    const summary = await refreshCustomListMetadata(userId, listId, {
      batchSize: 50,
      onProgress: (progress) => {
        console.log(`[${listId}] ${progress.current}/${progress.total}`);
      },
    });

    console.log(`✅ List refresh complete!`);
    console.log(`   - List: ${summary.listId}`);
    console.log(`   - Items in list: ${summary.totalItems}`);
    console.log(`   - Items refreshed: ${summary.refreshed}`);

    return summary;
  } catch (error) {
    console.error(`Error refreshing list ${listId}:`, error);
    throw error;
  }
};

// =============================================================================
// EXAMPLE 4: Check Metadata Completeness
// =============================================================================

/**
 * Display statistics about library metadata quality
 * Shows what percentage of items have IMDb ratings
 */
export const checkMetadataCompletenessExample = async (userId) => {
  try {
    console.log('📊 Analyzing metadata completeness...');

    const stats = await getMetadataStatistics(userId);

    console.log('\n📈 Library Metadata Statistics:');
    console.log(`   - Total items: ${stats.totalItems}`);
    console.log(`   - Items with data: ${stats.itemsWithMetadata}`);
    console.log(`   - Items without data: ${stats.itemsWithoutMetadata}`);
    console.log(`   - Completeness: ${stats.completeness}`);
    console.log(`   - Avg IMDb rating: ${stats.averageImdbRating}`);

    if (stats.itemsMissingData.length > 0) {
      console.log('\n⚠️ Items missing IMDb data:');
      stats.itemsMissingData.forEach((item) => {
        console.log(`   - ${item.title} (${item.id})`);
      });
    }

    return stats;
  } catch (error) {
    console.error('Error checking metadata:', error);
    throw error;
  }
};

// =============================================================================
// EXAMPLE 5: Get Items Missing Data (Diagnostic)
// =============================================================================

/**
 * Get list of specific items that don't have IMDb ratings
 * Useful for debugging or targeted refresh
 */
export const getMissingMetadataItemsExample = async (userId) => {
  try {
    console.log('🔍 Finding items with missing metadata...');

    const missingItems = await getItemsWithMissingMetadata(userId);

    console.log(`Found ${missingItems.length} items without IMDb data:\n`);

    missingItems.forEach((item, index) => {
      console.log(`${index + 1}. ${item.title}`);
      console.log(`   ID: ${item.id}`);
      console.log(`   Type: ${item.media_type}`);
      console.log(`   Added: ${item.dateAdded || 'Unknown'}`);
      console.log('');
    });

    return missingItems;
  } catch (error) {
    console.error('Error getting missing items:', error);
    throw error;
  }
};

// =============================================================================
// EXAMPLE 6: React Component - Settings Page Integration
// =============================================================================

/**
 * Example React component showing how to use refresh functions in UI
 */
export const SettingsPageComponentExample = () => {
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [progress, setProgress] = React.useState(null);
  const [stats, setStats] = React.useState(null);

  React.useEffect(() => {
    // Load stats on mount
    loadStats();
  }, []);

  const loadStats = async () => {
    const stats = await getMetadataStatistics(userId);
    setStats(stats);
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refreshLibraryMetadata(userId, {
        batchSize: 50,
        forceRefresh: false,
        onProgress: (p) => setProgress(p),
      });
      // Reload stats after refresh
      await loadStats();
    } finally {
      setIsRefreshing(false);
      setProgress(null);
    }
  };

  return (
    <div className="settings">
      <h2>Library Metadata</h2>

      {stats && (
        <div className="stats">
          <div>Total: {stats.totalItems}</div>
          <div>With Data: {stats.itemsWithMetadata}</div>
          <div>Completeness: {stats.completeness}</div>
          <div>Avg Rating: {stats.averageImdbRating}</div>
        </div>
      )}

      {progress && (
        <div className="progress">
          Refreshing: {progress.current}/{progress.total}
          <div className="progress-bar">
            <div
              style={{
                width: `${(progress.current / progress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      <button onClick={handleRefresh} disabled={isRefreshing}>
        {isRefreshing ? 'Refreshing...' : 'Refresh Missing Metadata'}
      </button>
    </div>
  );
};

// =============================================================================
// EXAMPLE 7: Scheduled Refresh (Future Enhancement)
// =============================================================================

/**
 * Example of how to schedule automatic metadata refresh
 * (Not implemented yet, but shows the pattern)
 */
export const scheduledRefreshExample = (userId) => {
  // Refresh every day at 2 AM
  const schedule = '0 2 * * *'; // cron format

  // Backend function (pseudo-code):
  // scheduledTask(userId, async () => {
  //   return await refreshLibraryMetadata(userId, {
  //     batchSize: 100,
  //     forceRefresh: false,
  //   });
  // });

  console.log('ℹ️ Scheduled refresh set for:', schedule);
};

// =============================================================================
// EXAMPLE 8: Batch Process Multiple Users (Admin Use Case)
// =============================================================================

/**
 * Example of how an admin might refresh metadata for multiple users
 * (Would need admin function in backend)
 */
export const batchRefreshMultipleUsersExample = async (userIds) => {
  const results = [];

  for (const userId of userIds) {
    try {
      console.log(`🔄 Refreshing user: ${userId}`);
      const summary = await refreshLibraryMetadata(userId, {
        batchSize: 50,
      });
      results.push({
        userId,
        success: true,
        refreshed: summary.refreshed,
      });
    } catch (error) {
      results.push({
        userId,
        success: false,
        error: error.message,
      });
    }
  }

  console.log('✅ Batch refresh complete:');
  console.log(results);

  return results;
};

// =============================================================================
// EXAMPLE 9: React Hook - useMetadataRefresh
// =============================================================================

/**
 * Custom React hook for managing metadata refresh state
 */
export const useMetadataRefreshExample = (userId) => {
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const [progress, setProgress] = React.useState(null);
  const [stats, setStats] = React.useState(null);
  const [summary, setSummary] = React.useState(null);

  const loadStats = React.useCallback(async () => {
    const stats = await getMetadataStatistics(userId);
    setStats(stats);
  }, [userId]);

  React.useEffect(() => {
    loadStats();
  }, [loadStats]);

  const refresh = React.useCallback(
    async (forceRefresh = false) => {
      setIsRefreshing(true);
      try {
        const result = await refreshLibraryMetadata(userId, {
          batchSize: 50,
          forceRefresh,
          onProgress: setProgress,
        });
        setSummary(result);
        await loadStats(); // Reload stats after refresh
      } finally {
        setIsRefreshing(false);
        setProgress(null);
      }
    },
    [userId, loadStats]
  );

  return {
    isRefreshing,
    progress,
    stats,
    summary,
    refresh,
    reloadStats: loadStats,
  };
};

// Usage in component:
// const hook = useMetadataRefreshExample(userId);
// <button onClick={() => hook.refresh()}>Refresh</button>
// {hook.progress && <div>{hook.progress.current}/{hook.progress.total}</div>}

// =============================================================================
// EXAMPLE 10: Error Recovery & Retry Logic
// =============================================================================

/**
 * Example of handling failures and retrying specific items
 */
export const handleRefreshErrorsExample = async (userId, summary) => {
  if (summary.errors.length === 0) {
    console.log('✅ All items refreshed successfully!');
    return;
  }

  console.warn(`⚠️ ${summary.errors.length} items failed to refresh`);

  // Optionally retry failed items
  const retryFailed = confirm(
    `Retry ${summary.errors.length} failed items?`
  );

  if (!retryFailed) return;

  console.log('🔄 Retrying failed items...');

  for (const failedItem of summary.errors) {
    try {
      console.log(`Retrying: ${failedItem.title}`);
      // In a real scenario, might want to retry with different logic
      await refreshLibraryMetadata(userId, {
        batchSize: 1,
        // Could filter to just this item
      });
    } catch (error) {
      console.error(`Still failed: ${failedItem.title}`);
    }
  }

  console.log('✅ Retry complete');
};

/**
 * =============================================================================
 * SUMMARY: When to Use Each Function
 * =============================================================================
 *
 * Use Case                          → Function
 * ─────────────────────────────────────────────────────────
 * Show stats in Settings            → getMetadataStatistics()
 * User clicks "Refresh Missing"     → refreshLibraryMetadata(forceRefresh: false)
 * Admin force refresh all           → refreshLibraryMetadata(forceRefresh: true)
 * Refresh one custom list           → refreshCustomListMetadata()
 * Find problem items                → getItemsWithMissingMetadata()
 * Debug why refresh failed          → Check summary.errors from return value
 * Scheduled daily refresh           → Use with cron/scheduled task
 * Multi-user admin tool             → Iterate with refreshLibraryMetadata()
 *
 * =============================================================================
 */
