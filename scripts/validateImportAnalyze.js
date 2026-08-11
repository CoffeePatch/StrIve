import {
  parseCsvPayload,
  migrateBackupPayload,
  analyzeImportPayload,
} from "../api/_lib/services/importAnalysisService.js";

async function runValidation() {
  console.log("=== Testing importAnalysisService ===");

  const testUserId = "test_verification_user";

  // 1. Test CSV Parsing
  const sampleCsv = `Title,Media Type,TMDB ID,IMDB ID,Status,User Rating,Notes,Lists
"Inception","movie",27208,"tt1375666","Completed",9.0,"Great movie","Favorites; Sci-Fi"
"Breaking Bad","tv",1399,"tt0903747","Watching",9.5,"Binge watching","Must Watch"`;

  const parsedCsv = parseCsvPayload(sampleCsv);
  console.log("CSV Parsing Result:");
  console.log(" - Library Items:", parsedCsv.library.length);
  console.log(" - Catalog Items:", parsedCsv.catalog.length);
  console.log(" - Custom Lists:", parsedCsv.lists.map(l => l.name));
  if (parsedCsv.library.length === 2 && parsedCsv.lists.length === 3) {
    console.log("✅ parseCsvPayload PASSED.");
  } else {
    throw new Error(`parseCsvPayload failed: expected 2 items and 3 lists, got ${parsedCsv.library.length} items and ${parsedCsv.lists.length} lists`);
  }

  // 2. Test Legacy Migration
  const legacyPayload = {
    exportDate: "2025-05-01T00:00:00.000Z",
    data: {
      watchlist: [
        { id: 550, title: "Fight Club", mediaType: "movie", imdbRating: 8.8 }
      ],
      watched: [
        { id: 27208, title: "Inception", mediaType: "movie", imdbRating: 8.8 }
      ]
    }
  };

  const migrated = migrateBackupPayload(legacyPayload);
  console.log("Legacy Migration Result:");
  console.log(" - Migrated Library Items:", migrated.library.length);
  console.log(" - Migrated Catalog Items:", migrated.catalog.length);
  if (migrated.library.length === 2) {
    console.log("✅ migrateBackupPayload PASSED.");
  } else {
    throw new Error("migrateBackupPayload failed to migrate legacy items");
  }

  // 3. Test analyzeImportPayload against DB
  const analysisResult = await analyzeImportPayload({
    userId: testUserId,
    rawPayload: sampleCsv,
    isCsv: true,
  });

  console.log("Diff Analysis Preview Result:");
  console.log(" - Valid:", analysisResult.valid);
  console.log(" - Summary Total Items:", analysisResult.summary.totalItems);
  console.log(" - Summary New Items:", analysisResult.summary.newItems);
  console.log(" - Summary Existing Items:", analysisResult.summary.existingItems);
  console.log(" - Summary Conflicts:", analysisResult.summary.conflicts);
  console.log(" - Summary New Lists:", analysisResult.summary.newListsCount);

  if (analysisResult.valid && analysisResult.summary.totalItems === 2) {
    console.log("✅ analyzeImportPayload PASSED.");
  } else {
    throw new Error("analyzeImportPayload failed diff computation");
  }

  console.log("=== All Import Analyze Verification Checks Passed ===");
  process.exit(0);
}

runValidation().catch(err => {
  console.error("❌ Validation Failed:", err);
  process.exit(1);
});
