import { createImportBatches } from "../src/domain/import/importController.js";
import { exportUserData } from "../api/_lib/services/exportService.js";
import { analyzeImportPayload } from "../api/_lib/services/importAnalysisService.js";
import { confirmImportBatch } from "../api/_lib/services/importConfirmService.js";
import prisma from "../api/_lib/prisma.js";

async function runStage24Verification() {
  console.log("==========================================================");
  console.log("  Stage 2.4 Verification — Frontend UI & Controller Tests ");
  console.log("==========================================================");

  const sourceUserId = "source_ui_test_user_1";
  const targetUserId = "target_ui_test_user_2";

  // --- 1. Test createImportBatches Chunking Logic ---
  console.log("\n[Test 1] Testing createImportBatches chunking helper...");
  const mockLibrary = Array.from({ length: 250 }, (_, i) => ({
    titleKey: `tmdb_movie_${i + 1}`,
    status: "completed",
    userRating: 8.0,
  }));
  const mockCatalog = mockLibrary.map(item => ({ titleKey: item.titleKey, title: `Movie ${item.titleKey}` }));

  const fullPayload = {
    format: "strive-backup",
    schemaVersion: 1,
    user: { id: sourceUserId, dashboardPreferences: {} },
    library: mockLibrary,
    episodeStates: [],
    lists: [{ id: "list_1", name: "Favorites", items: [{ titleKey: "tmdb_movie_1", position: 1.0 }] }],
    catalog: mockCatalog,
    seasons: [],
    episodes: [],
  };

  const batches = createImportBatches(fullPayload, 100);
  console.log(` ✓ Split ${mockLibrary.length} items into ${batches.length} sequential batches.`);
  console.log(` ✓ Batch 0 size: ${batches[0].library.length} items, lists: ${batches[0].lists.length}`);
  console.log(` ✓ Batch 1 size: ${batches[1].library.length} items, lists: ${batches[1].lists.length}`);
  console.log(` ✓ Batch 2 size: ${batches[2].library.length} items, lists: ${batches[2].lists.length}`);

  if (batches.length !== 3 || batches[0].lists.length !== 1 || batches[1].lists.length !== 0) {
    throw new Error("Test 1 Failed: createImportBatches did not split batches cleanly!");
  }
  console.log("✅ [Test 1 PASSED] Chunking controller logic verified.");

  // --- 2. Test End-to-End Import Sequence (Analyze -> Chunk -> Confirm Batch Loop) ---
  console.log("\n[Test 2] Simulating full end-to-end UI import controller execution...");

  // Seed source user with realistic data
  await prisma.user.upsert({ where: { id: sourceUserId }, create: { id: sourceUserId }, update: {} });
  await prisma.catalogTitle.upsert({ where: { titleKey: "tmdb_movie_999" }, create: { titleKey: "tmdb_movie_999", mediaType: "movie", title: "Inception" }, update: {} });
  await prisma.userLibraryItem.upsert({
    where: { userId_titleKey: { userId: sourceUserId, titleKey: "tmdb_movie_999" } },
    create: { userId: sourceUserId, titleKey: "tmdb_movie_999", status: "completed", userRating: 9.0 },
    update: {},
  });

  // Export
  const backup = await exportUserData({ userId: sourceUserId, format: "json" });

  // Analyze against clean target user
  await prisma.userLibraryItem.deleteMany({ where: { userId: targetUserId } });
  await prisma.user.deleteMany({ where: { id: targetUserId } });

  const analysis = await analyzeImportPayload({ userId: targetUserId, rawPayload: backup });
  console.log(" ✓ Analysis summary for clean target:", analysis.summary);

  // Split into batches
  const targetBatches = createImportBatches(backup, 100);
  console.log(` ✓ Target user import split into ${targetBatches.length} batch(es).`);

  // Execute sequential loop (simulating ImportReview controller loop)
  for (let i = 0; i < targetBatches.length; i++) {
    const confirmRes = await confirmImportBatch({
      userId: targetUserId,
      batchPayload: targetBatches[i],
      conflictStrategy: "MERGE",
    });
    console.log(` ✓ Batch ${i + 1}/${targetBatches.length} confirmed: processed=${confirmRes.processed}, created=${confirmRes.created}`);
  }

  // Verify target user state in DB
  const targetLibrary = await prisma.userLibraryItem.findMany({ where: { userId: targetUserId } });
  if (targetLibrary.length !== 1 || targetLibrary[0].titleKey !== "tmdb_movie_999") {
    throw new Error("Test 2 Failed: Target user restoration did not complete cleanly!");
  }
  console.log("✅ [Test 2 PASSED] End-to-end UI import controller simulation verified.");

  // Cleanup test users
  await prisma.userLibraryItem.deleteMany({ where: { userId: { in: [sourceUserId, targetUserId] } } });
  await prisma.user.deleteMany({ where: { id: { in: [sourceUserId, targetUserId] } } });

  console.log("\n==========================================================");
  console.log("  ALL STAGE 2.4 VERIFICATION TESTS PASSED (2/2)           ");
  console.log("==========================================================");
  process.exit(0);
}

runStage24Verification().catch(err => {
  console.error("❌ Stage 2.4 Verification Failed:", err);
  process.exit(1);
});
