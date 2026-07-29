import { listsAdapter } from '../../domain/lists/listsAdapter';
import { collection, getDocs, query, where, limit, doc, setDoc } from 'firebase/firestore';
import { db } from '../../util/firebase/firebase';
import { requestMetadataEnrichment } from '../metadataEnrichmentCoordinator';

class EnrichmentService {
  constructor() {
    this.isProcessing = false;
    this.queue = [];
  }

  async startEnrichment(userId) {
    if (this.isProcessing || !userId) return;
    this.isProcessing = true;
    console.log('Starting background enrichment...');

    try {
      const lists = await listsAdapter.fetchUserLists(userId);

      for (const list of lists) {
        if (!this.isProcessing) break;

        let pendingItems = [];
        try {
          const qPrimary = query(
            collection(db, 'users', userId, 'library_items'),
            where('tracking.listIds', 'array-contains', list.id),
            where('enrichmentStatus', '==', 'pending'),
            limit(5)
          );
          const snapPrimary = await getDocs(qPrimary);
          pendingItems = snapPrimary.docs.map((d) => ({ id: d.id, ...d.data() }));
        } catch (error) {
          console.warn('Primary enrichment query failed, falling back to local filtering:', error.message);
        }

        if (pendingItems.length < 5) {
          try {
            const qFailed = query(
              collection(db, 'users', userId, 'library_items'),
              where('tracking.listIds', 'array-contains', list.id),
              where('enrichmentStatus', '==', 'failed'),
              limit(5)
            );
            const snapFailed = await getDocs(qFailed);
            const failedItems = snapFailed.docs.map((d) => ({ id: d.id, ...d.data() }));

            const eligibleFailed = failedItems.filter((item) => {
              const retryCount = Number(item.enrichmentRetryCount || 0);
              const nextAttempt = item.nextEnrichmentAttempt;
              if (retryCount >= 3) return false;
              if (!nextAttempt) return true;
              return new Date(nextAttempt) <= new Date();
            });

            const seen = new Set(pendingItems.map((i) => i.id));
            for (const item of eligibleFailed) {
              if (!seen.has(item.id)) {
                pendingItems.push(item);
                if (pendingItems.length >= 5) break;
              }
            }
          } catch (error) {
            console.warn('Failed items enrichment query failed:', error.message);
          }
        }

        if (pendingItems.length < 5) {
          const qFallback = query(
            collection(db, 'users', userId, 'library_items'),
            where('tracking.listIds', 'array-contains', list.id),
            limit(50)
          );
          const snapFallback = await getDocs(qFallback);
          const candidates = snapFallback.docs.map((d) => ({ id: d.id, ...d.data() }));

          const legacyOrRetryEligible = candidates.filter((item) => {
            if (item.enrichmentStatus !== 'enriched' && item.enrichmentStatus !== 'failed') {
              return true;
            }
            if (item.enrichmentStatus === 'failed') {
              const retryCount = Number(item.enrichmentRetryCount || 0);
              const nextAttempt = item.nextEnrichmentAttempt;
              return retryCount < 3 && (!nextAttempt || new Date(nextAttempt) <= new Date());
            }
            return false;
          });

          const seen = new Set(pendingItems.map((i) => i.id));
          for (const item of legacyOrRetryEligible) {
            if (!seen.has(item.id)) {
              pendingItems.push(item);
              if (pendingItems.length >= 5) break;
            }
          }
        }

        if (pendingItems.length > 0) {
          console.log(`Found ${pendingItems.length} pending items in list ${list.name}`);

          for (const item of pendingItems) {
            if (!this.isProcessing) break;
            try {
              await this.enrichItem(userId, list.id, item);
            } catch (itemError) {
              console.error(`Unhandled error processing item ${item.title || item.id} in sync queue:`, itemError);
            }

            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      }
    } catch (error) {
      console.error('Enrichment process failed:', error);
    } finally {
      this.isProcessing = false;
      console.log('Enrichment process finished/stopped.');
    }
  }

  stop() {
    this.isProcessing = false;
  }

  async enrichItem(userId, listId, item) {
    try {
      console.log(`Enriching item: ${item.title} (ID: ${item.id})`);

      if (item.enrichmentStatus === 'enriched') {
        console.log(`${item.title} already enriched, skipping`);
        return;
      }

      const result = await requestMetadataEnrichment({
        item,
        userId,
        titleKey: item.id,
        persist: true,
        trackStatus: true,
      });

      if (result.hasData) {
        console.log(`✓ Enriched ${item.title} successfully. IMDb: ${result.imdbRating || 'N/A'}, TMDB: ${result.voteAverage || 'N/A'}`);
        return;
      }

      const titleKey = item.id;
      const libraryItemsRef = doc(db, 'users', userId, 'library_items', titleKey);
      const currentRetryCount = Number(item.enrichmentRetryCount || 0);
      const retryHours = Math.pow(2, currentRetryCount + 1);
      const failedUpdates = {
        enrichmentStatus: 'failed',
        enrichmentRetryCount: currentRetryCount + 1,
        lastEnrichmentAttempt: new Date().toISOString(),
        nextEnrichmentAttempt: new Date(Date.now() + retryHours * 60 * 60 * 1000).toISOString(),
      };
      await setDoc(libraryItemsRef, failedUpdates, { merge: true });

      console.log(`✗ No data found for ${item.title}, marked as failed (Retry #${currentRetryCount + 1})`);
    } catch (error) {
      console.error(`Error enriching item ${item.id}:`, error);

      try {
        const titleKey = item.id;
        const libraryItemsRef = doc(db, 'users', userId, 'library_items', titleKey);
        const currentRetryCount = Number(item.enrichmentRetryCount || 0);
        const retryHours = Math.pow(2, currentRetryCount + 1);
        const failedUpdates = {
          enrichmentStatus: 'failed',
          enrichmentRetryCount: currentRetryCount + 1,
          lastEnrichmentAttempt: new Date().toISOString(),
          nextEnrichmentAttempt: new Date(Date.now() + retryHours * 60 * 60 * 1000).toISOString(),
        };
        await setDoc(libraryItemsRef, failedUpdates, { merge: true });
      } catch (updateError) {
        console.error('Failed to mark item as failed:', updateError);
      }
    }
  }
}

export default new EnrichmentService();