import { buildSimklPayloads, createSimklBatches } from "../src/domain/simkl/simklSyncController.js";

async function runStage32Verification() {
  console.log("=================================================================");
  console.log("  Stage 3.2 Verification — Simkl Sync Controller & Payload");
  console.log("=================================================================");

  try {
    // --- Test 1: Payload Construction & Identifiers ---
    console.log("\n[Test 1] Testing Strive to Simkl Payload Conversion...");
    const mockLibraryItems = [
      {
        catalogTitle: { titleKey: "tmdb_movie_550", mediaType: "movie", tmdbId: 550, imdbId: "tt0137523", title: "Fight Club" },
        status: "completed",
        userRating: 9.0,
        lastWatchedAt: "2026-08-01T12:00:00Z",
      },
      {
        catalogTitle: { titleKey: "tmdb_tv_1399", mediaType: "tv", tmdbId: 1399, imdbId: "tt0903747", title: "Breaking Bad" },
        status: "watching",
        userRating: 10.0,
        lastWatchedAt: "2026-08-05T12:00:00Z",
      },
      {
        catalogTitle: { titleKey: "tmdb_movie_9999", mediaType: "movie", tmdbId: null, imdbId: null, title: "Unmapped Movie" },
        status: "completed",
      },
    ];

    const mockEpisodes = [
      { titleKey: "tmdb_tv_1399", seasonNumber: 1, episodeNumber: 1, state: "watched", watchedAt: "2026-08-02T12:00:00Z" },
      { titleKey: "tmdb_tv_1399", seasonNumber: 1, episodeNumber: 2, state: "watched", watchedAt: "2026-08-03T12:00:00Z" },
    ];

    const payloads = buildSimklPayloads(mockLibraryItems, mockEpisodes);

    console.log(" ✓ History Movies Count:", payloads.history.movies.length);
    console.log(" ✓ History Shows Count:", payloads.history.shows.length);
    console.log(" ✓ Ratings Movies Count:", payloads.ratings.movies.length);
    console.log(" ✓ Ratings Shows Count:", payloads.ratings.shows.length);
    console.log(" ✓ Skipped Unmapped Items:", mockLibraryItems.length - (payloads.history.movies.length + payloads.history.shows.length));

    if (payloads.history.movies.length !== 1 || payloads.history.shows.length !== 1 || payloads.ratings.movies.length !== 1) {
      throw new Error("Test 1 Failed: Payload construction mapping failed!");
    }
    console.log("✅ [Test 1 PASSED] Strive to Simkl payload conversion verified.");

    // --- Test 2: 100-Item Batch Chunking ---
    console.log("\n[Test 2] Testing 100-Item Batch Chunking...");
    const largeMockMovies = Array.from({ length: 250 }, (_, i) => ({
      title: `Movie ${i}`,
      ids: { tmdb: 1000 + i },
      watched_at: "2026-08-01T12:00:00Z",
    }));

    const batches = createSimklBatches({ movies: largeMockMovies, shows: [] }, "history");
    console.log(" ✓ Total Items:", largeMockMovies.length);
    console.log(" ✓ Total Batches Generated:", batches.length);
    console.log(" ✓ Batch 1 Size:", batches[0].itemCount);
    console.log(" ✓ Batch 2 Size:", batches[1].itemCount);
    console.log(" ✓ Batch 3 Size:", batches[2].itemCount);

    if (batches.length !== 3 || batches[0].itemCount !== 100 || batches[1].itemCount !== 100 || batches[2].itemCount !== 50) {
      throw new Error("Test 2 Failed: Batch chunking logic failed!");
    }
    console.log("✅ [Test 2 PASSED] 100-item sequential batch chunking verified.");

    console.log("\n=================================================================");
    console.log("  ALL STAGE 3.2 VERIFICATION TESTS PASSED (2/2)                  ");
    console.log("=================================================================");
    process.exit(0);
  } catch (err) {
    console.error("❌ Stage 3.2 Verification Failed:", err);
    process.exit(1);
  }
}

runStage32Verification();
