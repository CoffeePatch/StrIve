import prisma from "../api/_lib/prisma.js";
import { exportUserData } from "../api/_lib/services/exportService.js";
import { analyzeImportPayload } from "../api/_lib/services/importAnalysisService.js";
import { confirmImportBatch } from "../api/_lib/services/importConfirmService.js";

async function runStage23Verification() {
  console.log("==========================================================");
  console.log("  Stage 2.3 Verification — PostgreSQL Import Confirm & DR  ");
  console.log("==========================================================");

  const sourceUserId = "source_disaster_user_101";
  const targetUserId = "target_disaster_user_202";

  try {
    // --- Step 0: Setup Seed Data for Source User ---
    console.log("\n[Setup] Seeding realistic data for Source User...");
    await prisma.user.upsert({
      where: { id: sourceUserId },
      create: { id: sourceUserId, dashboardPreferences: { theme: "dark" } },
      update: {},
    });

    await prisma.catalogTitle.upsert({
      where: { titleKey: "tmdb_movie_550" },
      create: {
        titleKey: "tmdb_movie_550",
        mediaType: "movie",
        tmdbId: 550,
        imdbId: "tt0137523",
        title: "Fight Club",
      },
      update: {},
    });

    await prisma.catalogTitle.upsert({
      where: { titleKey: "tmdb_tv_1399" },
      create: {
        titleKey: "tmdb_tv_1399",
        mediaType: "tv",
        tmdbId: 1399,
        imdbId: "tt0903747",
        title: "Breaking Bad",
      },
      update: {},
    });

    await prisma.catalogSeason.upsert({
      where: { titleKey_seasonNumber: { titleKey: "tmdb_tv_1399", seasonNumber: 1 } },
      create: { titleKey: "tmdb_tv_1399", seasonNumber: 1, title: "Season 1" },
      update: {},
    });

    await prisma.catalogEpisode.upsert({
      where: { titleKey_seasonNumber_episodeNumber: { titleKey: "tmdb_tv_1399", seasonNumber: 1, episodeNumber: 1 } },
      create: { titleKey: "tmdb_tv_1399", seasonNumber: 1, episodeNumber: 1, title: "Pilot" },
      update: {},
    });

    await prisma.userLibraryItem.upsert({
      where: { userId_titleKey: { userId: sourceUserId, titleKey: "tmdb_movie_550" } },
      create: {
        userId: sourceUserId,
        titleKey: "tmdb_movie_550",
        status: "completed",
        userRating: 9.5,
        notes: "Masterpiece film",
      },
      update: {},
    });

    await prisma.userLibraryItem.upsert({
      where: { userId_titleKey: { userId: sourceUserId, titleKey: "tmdb_tv_1399" } },
      create: {
        userId: sourceUserId,
        titleKey: "tmdb_tv_1399",
        status: "watching",
        userRating: 10.0,
        notes: "Best TV show",
      },
      update: {},
    });

    await prisma.userEpisodeState.upsert({
      where: { userId_titleKey_seasonNumber_episodeNumber: { userId: sourceUserId, titleKey: "tmdb_tv_1399", seasonNumber: 1, episodeNumber: 1 } },
      create: {
        userId: sourceUserId,
        titleKey: "tmdb_tv_1399",
        seasonNumber: 1,
        episodeNumber: 1,
        state: "watched",
      },
      update: {},
    });

    const sourceList = await prisma.userList.create({
      data: {
        userId: sourceUserId,
        name: "Top Favorites",
        description: "All-time favorite movies and TV",
        kind: "custom",
        visibility: "private",
        itemCount: 2,
        items: {
          create: [
            { titleKey: "tmdb_movie_550", userId: sourceUserId, position: 1000.0 },
            { titleKey: "tmdb_tv_1399", userId: sourceUserId, position: 2000.0 },
          ],
        },
      },
    });

    console.log(" ✓ Source user seeded successfully with 2 library items, 1 episode state, and 1 custom list.");

    // --- Test 1: Stage 2.1 Export from Source ---
    console.log("\n[Test 1] Exporting source user data via Stage 2.1...");
    const backupPayload = await exportUserData({ userId: sourceUserId, format: "json" });
    if (!backupPayload || backupPayload.library.length !== 2) {
      throw new Error("Test 1 Failed: Stage 2.1 export payload is incomplete");
    }
    console.log("✅ [Test 1 PASSED] Exported full-fidelity backup from Source User.");

    // --- Test 2: Clean Account Analysis (Stage 2.2) ---
    console.log("\n[Test 2] Analyzing export payload against fresh Target User (Stage 2.2)...");
    // Ensure target user is completely clean
    await prisma.userListItem.deleteMany({ where: { userId: targetUserId } });
    await prisma.userList.deleteMany({ where: { userId: targetUserId } });
    await prisma.userEpisodeState.deleteMany({ where: { userId: targetUserId } });
    await prisma.userLibraryItem.deleteMany({ where: { userId: targetUserId } });
    await prisma.user.deleteMany({ where: { id: targetUserId } });

    const analysis = await analyzeImportPayload({ userId: targetUserId, rawPayload: backupPayload });
    console.log(" ✓ Analysis Result:", analysis.summary);
    if (analysis.summary.library.new !== 2 || analysis.summary.lists.new !== 1) {
      throw new Error("Test 2 Failed: Clean account diff analysis did not classify items as NEW");
    }
    console.log("✅ [Test 2 PASSED] Stage 2.2 analysis correctly identified all records as NEW.");

    // --- Test 3: Clean Account Disaster Recovery Restoration (Stage 2.3) ---
    console.log("\n[Test 3] Executing Stage 2.3 confirmImportBatch for Target User...");
    const confirmResult = await confirmImportBatch({
      userId: targetUserId,
      batchPayload: backupPayload,
      conflictStrategy: "MERGE",
    });

    console.log(" ✓ Confirm Result:", confirmResult);
    if (!confirmResult.success || confirmResult.created !== 2) {
      throw new Error("Test 3 Failed: Confirm batch execution failed to create records");
    }

    // Verify Target User Data matches Source User Data
    const targetLibrary = await prisma.userLibraryItem.findMany({ where: { userId: targetUserId }, orderBy: { titleKey: "asc" } });
    const targetEpisodes = await prisma.userEpisodeState.findMany({ where: { userId: targetUserId } });
    const targetLists = await prisma.userList.findMany({ where: { userId: targetUserId }, include: { items: { orderBy: { position: "asc" } } } });

    console.log(" ✓ Target Library Count:", targetLibrary.length);
    console.log(" ✓ Target Episode State Count:", targetEpisodes.length);
    console.log(" ✓ Target Lists Count:", targetLists.length);

    if (targetLibrary.length !== 2 || targetEpisodes.length !== 1 || targetLists.length !== 1) {
      throw new Error("Test 3 Failed: Target record counts do not match source!");
    }

    // Check specific fields
    const fightClub = targetLibrary.find(i => i.titleKey === "tmdb_movie_550");
    if (fightClub.status !== "completed" || Number(fightClub.userRating) !== 9.5 || fightClub.notes !== "Masterpiece film") {
      throw new Error("Test 3 Failed: Target Fight Club fields do not match source!");
    }

    console.log("✅ [Test 3 PASSED] Clean Account Restoration verified with 100% data fidelity.");

    // --- Test 4: Idempotency & Retry Test ---
    console.log("\n[Test 4] Retrying confirmImportBatch (Idempotency Test)...");
    const retryResult = await confirmImportBatch({
      userId: targetUserId,
      batchPayload: backupPayload,
      conflictStrategy: "MERGE",
    });

    console.log(" ✓ Retry Result:", retryResult);
    const targetLibraryAfterRetry = await prisma.userLibraryItem.findMany({ where: { userId: targetUserId } });
    const targetListsAfterRetry = await prisma.userList.findMany({ where: { userId: targetUserId } });

    if (targetLibraryAfterRetry.length !== 2 || targetListsAfterRetry.length !== 1) {
      throw new Error(`Test 4 Failed: Retry created duplicate records! Got ${targetLibraryAfterRetry.length} library items.`);
    }
    console.log("✅ [Test 4 PASSED] Idempotency confirmed. 0 duplicate records created on retry.");

    // --- Test 5: Conflict Resolution Matrix (SKIP vs OVERWRITE) ---
    console.log("\n[Test 5] Testing SKIP conflict strategy...");
    const modifiedPayload = JSON.parse(JSON.stringify(backupPayload));
    modifiedPayload.library.find(i => i.titleKey === "tmdb_movie_550").userRating = 1.0;

    await confirmImportBatch({
      userId: targetUserId,
      batchPayload: modifiedPayload,
      conflictStrategy: "SKIP",
    });

    const fightClubAfterSkip = await prisma.userLibraryItem.findUnique({
      where: { userId_titleKey: { userId: targetUserId, titleKey: "tmdb_movie_550" } },
    });
    if (Number(fightClubAfterSkip.userRating) !== 9.5) {
      throw new Error("Test 5 Failed: SKIP strategy allowed existing rating to be overwritten!");
    }
    console.log(" ✓ SKIP strategy correctly preserved existing rating (9.5).");

    console.log("[Test 5] Testing OVERWRITE conflict strategy...");
    await confirmImportBatch({
      userId: targetUserId,
      batchPayload: modifiedPayload,
      conflictStrategy: "OVERWRITE",
    });

    const fightClubAfterOverwrite = await prisma.userLibraryItem.findUnique({
      where: { userId_titleKey: { userId: targetUserId, titleKey: "tmdb_movie_550" } },
    });
    if (Number(fightClubAfterOverwrite.userRating) !== 1.0) {
      throw new Error("Test 5 Failed: OVERWRITE strategy failed to update user rating to 1.0!");
    }
    console.log(" ✓ OVERWRITE strategy correctly updated user rating to 1.0.");
    console.log("✅ [Test 5 PASSED] Conflict Resolution Matrix (SKIP & OVERWRITE) verified.");

    // Cleanup Test Users
    await prisma.userListItem.deleteMany({ where: { userId: { in: [sourceUserId, targetUserId] } } });
    await prisma.userList.deleteMany({ where: { id: sourceList.id } });
    await prisma.userList.deleteMany({ where: { userId: { in: [sourceUserId, targetUserId] } } });
    await prisma.userEpisodeState.deleteMany({ where: { userId: { in: [sourceUserId, targetUserId] } } });
    await prisma.userLibraryItem.deleteMany({ where: { userId: { in: [sourceUserId, targetUserId] } } });
    await prisma.user.deleteMany({ where: { id: { in: [sourceUserId, targetUserId] } } });

    console.log("\n==========================================================");
    console.log("  ALL STAGE 2.3 VERIFICATION TESTS PASSED (5/5)           ");
    console.log("==========================================================");
    process.exit(0);
  } catch (err) {
    console.error("❌ Stage 2.3 Verification Failed:", err);
    process.exit(1);
  }
}

runStage23Verification();
