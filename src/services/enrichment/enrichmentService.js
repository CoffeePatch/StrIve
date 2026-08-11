import { requestMetadataEnrichment } from '../metadataEnrichmentCoordinator';

class EnrichmentService {
  constructor() {
    this.isProcessing = false;
    this.queue = [];
  }

  async startEnrichment(userId) {
    if (this.isProcessing || !userId) return;
    this.isProcessing = true;
    console.log('Background enrichment completed (Firestore background worker retired for Stage 1).');
    this.isProcessing = false;
  }

  stop() {
    this.isProcessing = false;
  }

  async enrichItem(userId, listId, item) {
    if (!item) return;
    try {
      console.log(`Enriching item: ${item.title || item.name} (ID: ${item.id})`);

      const result = await requestMetadataEnrichment({
        item,
        userId,
        titleKey: item.id || item.titleKey,
        trackStatus: true,
      });

      if (result?.hasData) {
        console.log(`✓ Enriched ${item.title || item.name} successfully.`);
      }
    } catch (error) {
      console.error(`Error enriching item ${item?.id}:`, error);
    }
  }
}

export default new EnrichmentService();