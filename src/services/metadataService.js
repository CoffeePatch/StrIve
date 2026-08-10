import { firstNumber } from '../util/core/numberUtils';
import { deriveMetadataContext, needsMetadataRefresh, requestMetadataEnrichment } from './metadataEnrichmentCoordinator';
import { getAllLibraryItems } from './libraryService';

const collectMetadataTargets = async (userId) => {
  try {
    const items = await getAllLibraryItems(userId, { hydrate: false });
    return (items || []).map((item) => ({
      docId: item.titleKey || String(item.id),
      source: 'library_items',
      ...item,
    }));
  } catch (err) {
    console.warn('Failed to collect metadata targets:', err);
    return [];
  }
};

export const processMetadataItem = async (item, summary = null) => {
  const { tmdbId, titleKey } = deriveMetadataContext(item, item.docId);
  if (!tmdbId) {
    throw new Error('Missing TMDB id');
  }

  const result = await requestMetadataEnrichment({
    item,
    titleKey,
    forceRefresh: true,
    trackStatus: false,
  });

  if (result.hasData) {
    if (summary) {
      summary.refreshed++;
      if (summary.bySource && summary.bySource[item.source] !== undefined) {
        summary.bySource[item.source] += 1;
      }
    }
    console.log(`Refreshed: ${item.title || item.name || item.docId} (${item.source})`);
  } else {
    console.warn(`No metadata found for: ${item.title || item.name || item.docId}`);
  }
};

export const refreshLibraryMetadata = async (
  userId,
  options = {}
) => {
  const {
    batchSize = 50,
    forceRefresh = false,
    onProgress = null,
  } = options;

  try {
    const allTargets = await collectMetadataTargets(userId);
    const itemsToRefresh = allTargets
      .filter((item) => needsMetadataRefresh(item, forceRefresh))
      .slice(0, batchSize);

    const summary = {
      totalItems: allTargets.length,
      itemsToRefresh: itemsToRefresh.length,
      refreshed: 0,
      failed: 0,
      errors: [],
      startTime: new Date(),
      bySource: {
        library_items: 0,
        library: 0,
        custom_list_items: 0,
      },
    };

    console.log(`Starting metadata refresh for ${itemsToRefresh.length} items (batch size: ${batchSize})`);

    for (let i = 0; i < itemsToRefresh.length; i++) {
      const item = itemsToRefresh[i];

      try {
        if (onProgress) {
          onProgress({
            current: i + 1,
            total: itemsToRefresh.length,
            itemTitle: item.title,
          });
        }

        await processMetadataItem(item, summary);
      } catch (error) {
        summary.failed++;
        summary.errors.push({
          itemId: item.id || item.docId,
          title: item.title || item.name || item.docId,
          source: item.source,
          error: error.message,
        });
        console.error(`Failed to refresh ${item.title || item.name || item.docId}:`, error.message);
      }

      if (i < itemsToRefresh.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    summary.endTime = new Date();
    summary.duration = summary.endTime - summary.startTime;
    console.log('Metadata refresh complete:', summary);
    return summary;
  } catch (error) {
    console.error('Error refreshing library metadata:', error);
    throw error;
  }
};

export const getItemsWithMissingMetadata = async (userId) => {
  try {
    const allTargets = await collectMetadataTargets(userId);

    const missingMetadata = allTargets
      .filter((item) => needsMetadataRefresh(item, false))
      .map((item) => ({
        id: item.id || item.docId,
        title: item.title || item.name || item.docId,
        mediaType: deriveMetadataContext(item, item.docId).mediaType,
        source: item.source,
        listId: item.listId || null,
      }));

    console.log(`Found ${missingMetadata.length} items with missing metadata`);
    return missingMetadata;
  } catch (error) {
    console.error('Error getting items with missing metadata:', error);
    throw error;
  }
};

export const getMetadataStatistics = async (userId) => {
  try {
    const items = await collectMetadataTargets(userId);
    const withRatings = items.filter((item) => !needsMetadataRefresh(item, false));
    const withoutRatings = items.filter((item) => needsMetadataRefresh(item, false));

    const sourceCounts = items.reduce((acc, item) => {
      const key = item.source || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const stats = {
      totalItems: items.length,
      itemsWithMetadata: withRatings.length,
      itemsWithoutMetadata: withoutRatings.length,
      completeness: items.length > 0 ? ((withRatings.length / items.length) * 100).toFixed(2) + '%' : '0%',
      averageImdbRating: withRatings.length > 0
        ? (
          withRatings.reduce(
            (sum, item) => sum + (firstNumber(item.imdbRating, item.imdb_rating) || 0),
            0
          ) / withRatings.length
        ).toFixed(2)
        : 'N/A',
      sourceCounts,
      itemsMissingData: withoutRatings.map((item) => ({
        id: item.id || item.docId,
        title: item.title || item.name || item.docId,
        mediaType: deriveMetadataContext(item, item.docId).mediaType,
        source: item.source,
      })),
    };

    return stats;
  } catch (error) {
    console.error('Error getting metadata statistics:', error);
    throw error;
  }
};