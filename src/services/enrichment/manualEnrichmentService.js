import { requestMetadataEnrichment } from '../metadataEnrichmentCoordinator';

class ManualEnrichmentService {
  constructor() {
    this.isProcessing = false;
    this.shouldStop = false;
  }

  async enrichList(userId, listId, items, onProgress, onComplete) {
    if (this.isProcessing) {
      console.log('Enrichment already in progress');
      return;
    }

    this.isProcessing = true;
    this.shouldStop = false;

    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < items.length; i++) {
        if (this.shouldStop) {
          console.log('Enrichment stopped by user');
          break;
        }

        const item = items[i];

        try {
          if (onProgress) {
            onProgress(i, items.length, item, { status: 'processing' });
          }

          const result = await this.enrichSingleItem(userId, item);

          if (result?.hasData) {
            if (onProgress) {
              onProgress(i, items.length, item, {
                status: 'success',
                ...result,
              });
            }
            successCount++;
          } else {
            if (onProgress) {
              onProgress(i, items.length, item, { status: 'failed' });
            }
            failCount++;
          }
        } catch (error) {
          console.error(`Error enriching ${item.title}:`, error);

          if (onProgress) {
            onProgress(i, items.length, item, { status: 'error', error: error.message });
          }

          failCount++;
        }

        if (i < items.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      }
    } finally {
      this.isProcessing = false;

      if (onComplete) {
        onComplete(successCount, failCount);
      }
    }
  }

  async enrichSingleItem(userId, item) {
    console.log(`🔍 Enriching: ${item.title || item.name}`);

    const result = await requestMetadataEnrichment({
      item,
      userId,
      titleKey: item.id || item.titleKey,
      trackStatus: true,
    });

    if (result?.hasData) {
      console.log(`  🎯 Final display rating: ${result.voteAverage} (${result.imdbRating ? 'IMDb' : 'TMDB'})`);
      console.log(`✅ ${item.title || item.name} enrichment complete\n`);
      return result;
    }

    console.log(`❌ ${item.title || item.name} - No data from any source\n`);
    return null;
  }

  stop() {
    this.shouldStop = true;
  }

  isRunning() {
    return this.isProcessing;
  }
}

export default new ManualEnrichmentService();