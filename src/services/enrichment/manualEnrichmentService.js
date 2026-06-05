import { updateLibraryItem } from "../../util/firebase/firestoreService";
import tmdbApiService from "../tmdb/tmdbApiService";
import imdbApiService from "../imdb/imdbApiService";

/**
 * Manual Enrichment Service
 * Handles manual enrichment with progress callbacks for UI updates
 */
class ManualEnrichmentService {
  constructor() {
    this.isProcessing = false;
    this.shouldStop = false;
  }

  /**
   * Enrich all items in a list with progress tracking
   * @param {string} userId 
   * @param {string} listId 
   * @param {Array} items - Items to enrich
   * @param {Function} onProgress - Callback(currentIndex, total, item, updates)
   * @param {Function} onComplete - Callback(successCount, failCount)
   */
  async enrichList(userId, listId, items, onProgress, onComplete) {
    if (this.isProcessing) {
      console.log("Enrichment already in progress");
      return;
    }

    this.isProcessing = true;
    this.shouldStop = false;

    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < items.length; i++) {
        if (this.shouldStop) {
          console.log("Enrichment stopped by user");
          break;
        }

        const item = items[i];
        
        try {
          // Call progress callback with item being processed
          if (onProgress) {
            onProgress(i, items.length, item, { status: 'processing' });
          }

          const updates = await this.enrichSingleItem(item);

          if (updates && Object.keys(updates).length > 0) {
            // Update Firestore
            await updateLibraryItem(userId, item, updates);
            
            // Call progress callback with success
            if (onProgress) {
              onProgress(i, items.length, item, { 
                status: 'success', 
                ...updates 
              });
            }

            successCount++;
          } else {
            // No data found
            await updateLibraryItem(userId, item, {
              enrichmentStatus: "failed",
              lastEnriched: new Date().toISOString(),
            });

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

        // Throttle: Wait 1.5 seconds between items
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

  /**
   * Enrich a single item and return updates
   * @param {Object} item 
   * @returns {Object} updates
   */
  async enrichSingleItem(item) {
    console.log(`🔍 Enriching: ${item.title}`);
    const updates = {};
    let hasTmdbData = false;
    let hasImdbData = false;

    const tmdbId = item.tmdbId;
    const imdbId = item.imdbId;

    // 1. Fetch TMDB Data
    if (tmdbId) {
      try {
        console.log(`  📊 Fetching TMDB data for ${item.title} (ID: ${tmdbId})...`);
        const tmdbData = await tmdbApiService.getDetails(
          item.media_type || "movie",
          tmdbId
        );

        if (tmdbData) {
          hasTmdbData = true;
          updates.tmdb_rating = tmdbData.vote_average || null;
          updates.tmdb_vote_count = tmdbData.vote_count || null;
          updates.overview = tmdbData.overview || null;
          updates.backdrop_path = tmdbData.backdrop_path || null;
          console.log(`  ✅ TMDB: Rating ${updates.tmdb_rating}, Votes ${updates.tmdb_vote_count}`);
        } else {
          console.log(`  ❌ TMDB: No data returned`);
        }
      } catch (error) {
        console.error(`  ❌ TMDB fetch failed for ${item.title}:`, error);
      }
    } else {
      console.log(`  ⚠️  No TMDB ID for ${item.title}`);
    }

    // 2. Fetch IMDb Data
    if (imdbId) {
      try {
        console.log(`  🎬 Fetching IMDb data for ${item.title} (ID: ${imdbId})...`);
        const imdbData = await imdbApiService.getTitle(imdbId);
        const enrichedImdb = imdbApiService.extractEnrichmentData(imdbData);

        if (enrichedImdb && enrichedImdb.imdb_rating) {
          hasImdbData = true;
          updates.imdb_rating = enrichedImdb.imdb_rating;
          updates.imdb_vote_count = enrichedImdb.imdb_vote_count;
          console.log(`  ✅ IMDb: Rating ${updates.imdb_rating}, Votes ${updates.imdb_vote_count}`);
        } else {
          console.log(`  ❌ IMDb: No rating data returned`);
        }
      } catch (error) {
        console.error(`  ❌ IMDb fetch failed for ${item.title}:`, error);
      }
    } else {
      console.log(`  ⚠️  No IMDb ID for ${item.title}`);
    }

    // 3. Compute display rating (prioritize IMDb over TMDB)
    if (hasTmdbData || hasImdbData) {
      updates.vote_average = updates.imdb_rating || updates.tmdb_rating || null;
      updates.vote_count = updates.imdb_vote_count || updates.tmdb_vote_count || null;
      updates.enrichmentStatus = "enriched";
      updates.lastEnriched = new Date().toISOString();
      
      console.log(`  🎯 Final display rating: ${updates.vote_average} (${updates.imdb_rating ? 'IMDb' : 'TMDB'})`);
      console.log(`✅ ${item.title} enrichment complete\n`);
      
      return updates;
    }

    console.log(`❌ ${item.title} - No data from any source\n`);
    return null;
  }

  /**
   * Stop the enrichment process
   */
  stop() {
    this.shouldStop = true;
  }

  /**
   * Check if enrichment is running
   */
  isRunning() {
    return this.isProcessing;
  }
}

export default new ManualEnrichmentService();
