import { updateLibraryItem } from "../../util/firebase/firestoreService";
import { listsAdapter } from "../../domain/lists/listsAdapter";
import { getDocs, query, collection, where, limit } from "firebase/firestore";
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
        const q = query(
          collection(db, "users", userId, "library_items"),
          where("tracking.listIds", "array-contains", list.id),
          limit(5)
        );
        const snap = await getDocs(q);
        const pendingItems = snap.docs.map(d => ({id: d.id, ...d.data()})).filter(i => i.enrichmentStatus !== 'enriched');

        if (pendingItems.length > 0) {
          console.log(
            `Found ${pendingItems.length} pending items in list ${list.name}`
          );

          // Process each item
          for (const item of pendingItems) {
            if (!this.isProcessing) break;
            await this.enrichItem(userId, list.id, item);

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
        
        await updateLibraryItem(userId, item, updates);
        console.log(
          `✓ Enriched ${item.title} successfully. IMDb: ${updates.imdb_rating || 'N/A'}, TMDB: ${updates.tmdb_rating || 'N/A'}`
        );
      } else {
        // Mark as failed enrichment
        await updateLibraryItem(userId, item, {
          enrichmentStatus: "failed",
          lastEnriched: new Date().toISOString(),
        });
        console.log(`✗ No data found for ${item.title}, marked as failed`);
      }
    } catch (error) {
      console.error(`Error enriching item ${item.id}:`, error);
      
      // Mark as failed
      try {
        await updateLibraryItem(userId, item, {
          enrichmentStatus: "failed",
          lastEnriched: new Date().toISOString(),
        });
      } catch (updateError) {
        console.error(`Failed to mark item as failed:`, updateError);
      }
    }
  }
}

export default new EnrichmentService();
