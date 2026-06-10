
import tmdbApiService from "../tmdb/tmdbApiService";
import imdbApiService from "../imdb/imdbApiService";
import { db } from "../../util/firebase/firebase";
import { doc, setDoc, deleteField } from "firebase/firestore";

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


            if (onProgress) {
              onProgress(i, items.length, item, { status: 'failed' });
            }

            failCount++;
          }
        } catch (error) {
          console.error(`Error enriching ${item.title}:`, error);
          
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
          } catch (writeErr) {
            console.error(`Failed to write failed enrichment status:`, writeErr);
          }

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
