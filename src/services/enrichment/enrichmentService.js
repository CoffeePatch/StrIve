
import { listsAdapter } from "../../domain/lists/listsAdapter";
import { getDocs, query, collection, where, limit, doc, setDoc, deleteField } from "firebase/firestore";
import { db } from "../../util/firebase/firebase";
import tmdbApiService from "../tmdb/tmdbApiService";
import imdbApiService from "../imdb/imdbApiService";

/**
 * Enrichment Service
 * Orchestrates the fetching of missing data for items in the background.
 */
class EnrichmentService {
  constructor() {
    this.isProcessing = false;
    this.queue = [];
  }

  /**
   * Start the enrichment process for a user
   * @param {string} userId
   */
  async startEnrichment(userId) {
    if (this.isProcessing || !userId) return;
    this.isProcessing = true;
    console.log("Starting background enrichment...");

    try {
      // 1. Get all user lists
      const lists = await listsAdapter.fetchUserLists(userId);

      // 2. Iterate through lists to find pending items
      for (const list of lists) {
        if (!this.isProcessing) break; // Stop if requested

        // Get a batch of pending items
        let pendingItems = [];
        try {
          // Primary query: fast index-based lookup
          const qPrimary = query(
            collection(db, "users", userId, "library_items"),
            where("tracking.listIds", "array-contains", list.id),
            where("enrichmentStatus", "==", "pending"),
            limit(5)
          );
          const snapPrimary = await getDocs(qPrimary);
          pendingItems = snapPrimary.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (error) {
          console.warn("Primary enrichment query failed, falling back to local filtering:", error.message);
        }

        // Query failed items that are eligible for retry
        if (pendingItems.length < 5) {
          try {
            const qFailed = query(
              collection(db, "users", userId, "library_items"),
              where("tracking.listIds", "array-contains", list.id),
              where("enrichmentStatus", "==", "failed"),
              limit(5)
            );
            const snapFailed = await getDocs(qFailed);
            const failedItems = snapFailed.docs.map(d => ({ id: d.id, ...d.data() }));
            
            // Filter failed items locally for retry eligibility (max 3 retries, exponential backoff has passed)
            const eligibleFailed = failedItems.filter(item => {
              const retryCount = Number(item.enrichmentRetryCount || 0);
              const nextAttempt = item.nextEnrichmentAttempt;
              if (retryCount >= 3) return false;
              if (!nextAttempt) return true;
              return new Date(nextAttempt) <= new Date();
            });

            const seen = new Set(pendingItems.map(i => i.id));
            for (const item of eligibleFailed) {
              if (!seen.has(item.id)) {
                pendingItems.push(item);
                if (pendingItems.length >= 5) break;
              }
            }
          } catch (error) {
            console.warn("Failed items enrichment query failed:", error.message);
          }
        }

        // Fallback query: if combined items are still fewer than 5, fetch 50 and filter locally for legacy or retry-eligible items
        if (pendingItems.length < 5) {
          const qFallback = query(
            collection(db, "users", userId, "library_items"),
            where("tracking.listIds", "array-contains", list.id),
            limit(50)
          );
          const snapFallback = await getDocs(qFallback);
          const candidates = snapFallback.docs.map(d => ({ id: d.id, ...d.data() }));

          const legacyOrRetryEligible = candidates.filter(i => {
            // Unenriched legacy items (no status, or status not enriched/failed)
            if (i.enrichmentStatus !== 'enriched' && i.enrichmentStatus !== 'failed') {
              return true;
            }
            // Failed retry-eligible items
            if (i.enrichmentStatus === 'failed') {
              const retryCount = Number(i.enrichmentRetryCount || 0);
              const nextAttempt = i.nextEnrichmentAttempt;
              return retryCount < 3 && (!nextAttempt || new Date(nextAttempt) <= new Date());
            }
            return false;
          });
            
          const seen = new Set(pendingItems.map(i => i.id));
          for (const item of legacyOrRetryEligible) {
            if (!seen.has(item.id)) {
              pendingItems.push(item);
              if (pendingItems.length >= 5) break;
            }
          }
        }

        if (pendingItems.length > 0) {
          console.log(
            `Found ${pendingItems.length} pending items in list ${list.name}`
          );

          // Process each item
          for (const item of pendingItems) {
            if (!this.isProcessing) break;
            try {
              await this.enrichItem(userId, list.id, item);
            } catch (itemError) {
              console.error(`Unhandled error processing item ${item.title || item.id} in sync queue:`, itemError);
            }

            // Throttle: Wait 2 seconds between items
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      }
    } catch (error) {
      console.error("Enrichment process failed:", error);
    } finally {
      this.isProcessing = false;
      console.log("Enrichment process finished/stopped.");
    }
  }

  stop() {
    this.isProcessing = false;
  }

  /**
   * Enrich a single item
   */
  async enrichItem(userId, listId, item) {
    try {
      console.log(`Enriching item: ${item.title} (ID: ${item.id})`);

      // Skip if already enriched
      if (item.enrichmentStatus === "enriched") {
        console.log(`${item.title} already enriched, skipping`);
        return;
      }

      let updates = {};
      let hasTmdbData = false;
      let hasImdbData = false;

      const tmdbId = item.tmdbId;
      const imdbId = item.imdbId;

      // 1. Fetch TMDB Data (ratings, overview, backdrop)
      if (tmdbId) {
        console.log(`Fetching TMDB data for ${item.title} (TMDB: ${tmdbId})`);
        
        const tmdbData = await tmdbApiService.getDetails(
          item.media_type || "movie",
          tmdbId
        );
        
        if (tmdbData) {
          hasTmdbData = true;
          
          // Extract TMDB ratings
          updates.tmdb_rating = tmdbData.vote_average || null;
          updates.tmdb_vote_count = tmdbData.vote_count || null;
          
          // Extract metadata
          updates.overview = tmdbData.overview || null;
          updates.backdrop_path = tmdbData.backdrop_path || null;
          
          console.log(`✓ TMDB data fetched for ${item.title}`);
        }
      }

      // 2. Fetch IMDb Data (ratings - prioritize over TMDB)
      if (imdbId) {
        console.log(`Fetching IMDb data for ${item.title} (IMDb: ${imdbId})`);
        
        const imdbData = await imdbApiService.getTitle(imdbId);
        const enrichedImdb = imdbApiService.extractEnrichmentData(imdbData);
        
        if (enrichedImdb && enrichedImdb.imdb_rating) {
          hasImdbData = true;
          
          updates.imdb_rating = enrichedImdb.imdb_rating;
          updates.imdb_vote_count = enrichedImdb.imdb_vote_count;
          
          console.log(`✓ IMDb data fetched for ${item.title}`);
        }
      }

      // 3. Only mark as enriched if we got data from at least one source
      if (hasTmdbData || hasImdbData) {
        // Compute display rating (prioritize IMDb over TMDB)
        updates.vote_average = updates.imdb_rating || updates.tmdb_rating || null;
        updates.vote_count = updates.imdb_vote_count || updates.tmdb_vote_count || null;
        
        updates.enrichmentStatus = "enriched";
        updates.lastEnriched = new Date().toISOString();
        
        // Write updates to the primary library_items subcollection (both flat & nested)
        const titleKey = item.id;
        const libraryItemsRef = doc(db, "users", userId, "library_items", titleKey);
        const nestedUpdates = {
          imdbId: updates.imdb_rating ? (item.imdbId || updates.imdbId || null) : (item.imdbId || null),
          imdbRating: deleteField(),
          imdbVotes: deleteField(),
          imdb_rating: deleteField(),
          imdb_vote_count: deleteField(),
          vote_average: deleteField(),
          vote_count: deleteField(),
          tmdb_rating: deleteField(),
          tmdb_vote_count: deleteField(),
          overview: updates.overview || null,
          backdrop_path: updates.backdrop_path || null,
          enrichmentStatus: updates.enrichmentStatus,
          lastEnriched: updates.lastEnriched,
          nextEnrichmentAttempt: null, // Clear scheduled attempt on success, retain count/lastAttempt
          sort: {
            imdbRating: deleteField(),
            imdbVotes: deleteField(),
            tmdbRating: deleteField(),
            tmdbVotes: deleteField(),
          },
          ratings: {
            imdbScore: updates.imdb_rating || null,
            imdbVotes: updates.imdb_vote_count || null,
            tmdbScore: updates.tmdb_rating || 0,
            tmdbVotes: updates.tmdb_vote_count || 0,
          }
        };
        await setDoc(libraryItemsRef, nestedUpdates, { merge: true });


        console.log(
          `✓ Enriched ${item.title} successfully. IMDb: ${updates.imdb_rating || 'N/A'}, TMDB: ${updates.tmdb_rating || 'N/A'}`
        );
      } else {
        // Mark as failed enrichment
        const titleKey = item.id;
        const libraryItemsRef = doc(db, "users", userId, "library_items", titleKey);
        const currentRetryCount = Number(item.enrichmentRetryCount || 0);
        const retryHours = Math.pow(2, currentRetryCount + 1); // Exponential backoff: 2h, 4h, 8h...
        const failedUpdates = {
          enrichmentStatus: "failed",
          enrichmentRetryCount: currentRetryCount + 1,
          lastEnrichmentAttempt: new Date().toISOString(),
          nextEnrichmentAttempt: new Date(Date.now() + retryHours * 60 * 60 * 1000).toISOString(),
        };
        await setDoc(libraryItemsRef, failedUpdates, { merge: true });


        console.log(`✗ No data found for ${item.title}, marked as failed (Retry #${currentRetryCount + 1})`);
      }
    } catch (error) {
      console.error(`Error enriching item ${item.id}:`, error);
      
      // Mark as failed
      try {
        const titleKey = item.id;
        const libraryItemsRef = doc(db, "users", userId, "library_items", titleKey);
        const currentRetryCount = Number(item.enrichmentRetryCount || 0);
        const retryHours = Math.pow(2, currentRetryCount + 1);
        const failedUpdates = {
          enrichmentStatus: "failed",
          enrichmentRetryCount: currentRetryCount + 1,
          lastEnrichmentAttempt: new Date().toISOString(),
          nextEnrichmentAttempt: new Date(Date.now() + retryHours * 60 * 60 * 1000).toISOString(),
        };
        await setDoc(libraryItemsRef, failedUpdates, { merge: true });


      } catch (updateError) {
        console.error(`Failed to mark item as failed:`, updateError);
      }
    }
  }
}

export default new EnrichmentService();
