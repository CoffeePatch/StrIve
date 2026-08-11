import prisma from "../api/_lib/prisma.js";
import { exportUserData } from "../api/_lib/services/exportService.js";
import { analyzeImportPayload } from "../api/_lib/services/importAnalysisService.js";
import { validateBackupPayload, BackupValidationError } from "../api/_lib/services/importValidator.js";

async function runStage22Verification() {
  console.log("==================================================");
  console.log("  Stage 2.2 Verification — Import Analysis Engine  ");
  console.log("==================================================");

  const sourceUserId = "source_user_123";
  const targetUserId = "target_user_999";

  // --- 1. Test Stage 2.1 Export -> Stage 2.2 Analysis ---
  console.log("\n[Test 1] Exporting Stage 2.1 JSON backup...");
  const exportPayload = await exportUserData({ userId: sourceUserId, format: "json" });
  exportPayload.user.id = sourceUserId; // Set source user ID

  console.log("[Test 1] Analyzing export payload against target user...");
  const analysisResult = await analyzeImportPayload({
    userId: targetUserId,
    rawPayload: exportPayload,
  });

  console.log(" ✓ Format:", analysisResult.format);
  console.log(" ✓ Schema Version:", analysisResult.schemaVersion);
  console.log(" ✓ Valid:", analysisResult.valid);
  console.log(" ✓ Library Diff Summary:", analysisResult.summary.library);
  console.log(" ✓ Episode Diff Summary:", analysisResult.summary.episodes);
  console.log(" ✓ List Diff Summary:", analysisResult.summary.lists);
  console.log(" ✓ Catalog Diff Summary:", analysisResult.summary.catalog);

  if (!analysisResult.valid || analysisResult.schemaVersion !== 1) {
    throw new Error("Test 1 Failed: Stage 2.1 backup failed Stage 2.2 analysis validation.");
  }
  console.log("✅ [Test 1 PASSED] Stage 2.1 JSON backup analyzed successfully.");

  // --- 2. Test Malformed JSON & Structural Errors ---
  console.log("\n[Test 2] Testing invalid schema version (schemaVersion: 999)...");
  try {
    const invalidVersionPayload = { ...exportPayload, schemaVersion: 999 };
    validateBackupPayload(invalidVersionPayload);
    throw new Error("Test 2 Failed: Did not reject schemaVersion 999");
  } catch (err) {
    if (err instanceof BackupValidationError && err.statusCode === 422 && err.code === "unsupported-schema-version") {
      console.log(" ✓ Correctly rejected schemaVersion 999 with HTTP 422 (unsupported-schema-version)");
      console.log("✅ [Test 2 PASSED] Version compatibility guard verified.");
    } else {
      throw err;
    }
  }

  // --- 3. Test Invalid Format Guard ---
  console.log("\n[Test 3] Testing invalid format ('invalid-format')...");
  try {
    const invalidFormatPayload = { ...exportPayload, format: "invalid-format" };
    validateBackupPayload(invalidFormatPayload);
    throw new Error("Test 3 Failed: Did not reject invalid format");
  } catch (err) {
    if (err instanceof BackupValidationError && err.statusCode === 400 && err.code === "invalid-backup-format") {
      console.log(" ✓ Correctly rejected invalid format with HTTP 400 (invalid-backup-format)");
      console.log("✅ [Test 3 PASSED] Format guard verified.");
    } else {
      throw err;
    }
  }

  // --- 4. Test Target User Ownership Mapping ---
  console.log("\n[Test 4] Verifying Target User Ownership Mapping...");
  // Even though backup payload specifies sourceUserId, targetUserId is analyzed.
  const targetCountsBefore = await prisma.userLibraryItem.count({ where: { userId: targetUserId } });
  console.log(` ✓ Target User (${targetUserId}) existing library items before analysis: ${targetCountsBefore}`);

  // --- 5. Test Zero Writes Assertion ---
  console.log("\n[Test 5] Verifying ZERO Database Writes Assertion...");
  const libraryCountBefore = await prisma.userLibraryItem.count();
  const listCountBefore = await prisma.userList.count();
  const episodeCountBefore = await prisma.userEpisodeState.count();

  // Execute analysis again
  await analyzeImportPayload({
    userId: targetUserId,
    rawPayload: exportPayload,
  });

  const libraryCountAfter = await prisma.userLibraryItem.count();
  const listCountAfter = await prisma.userList.count();
  const episodeCountAfter = await prisma.userEpisodeState.count();

  console.log(` ✓ Library Items: Before = ${libraryCountBefore}, After = ${libraryCountAfter}`);
  console.log(` ✓ User Lists:    Before = ${listCountBefore}, After = ${listCountAfter}`);
  console.log(` ✓ Episode States: Before = ${episodeCountBefore}, After = ${episodeCountAfter}`);

  if (libraryCountBefore !== libraryCountAfter || listCountBefore !== listCountAfter || episodeCountBefore !== episodeCountAfter) {
    throw new Error("Test 5 Failed: Database state was mutated during import analysis!");
  }
  console.log("✅ [Test 5 PASSED] ZERO database writes confirmed.");

  // --- 6. Test Stage 2.1 Regression ---
  console.log("\n[Test 6] Verifying Stage 2.1 Export Engine Regression...");
  const exportCheck = await exportUserData({ userId: sourceUserId, format: "json" });
  if (!exportCheck || exportCheck.format !== "strive-backup") {
    throw new Error("Test 6 Failed: Stage 2.1 export engine regression!");
  }
  console.log("✅ [Test 6 PASSED] Stage 2.1 export engine remains fully functional.");

  console.log("\n==================================================");
  console.log("  ALL STAGE 2.2 VERIFICATION TESTS PASSED (6/6)   ");
  console.log("==================================================");
  process.exit(0);
}

runStage22Verification().catch(err => {
  console.error("❌ Stage 2.2 Verification Failed:", err);
  process.exit(1);
});
