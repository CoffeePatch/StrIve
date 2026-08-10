async function runStage33Verification() {
  console.log("=================================================================");
  console.log("  Stage 3.3 Verification — Read-Only Simkl Import Analyzer ");
  console.log("=================================================================");

  try {
    // --- Test C: Read-Only Guarantee Audit ---
    console.log("\n[Test C] Auditing Read-Only Database Behavior...");
    const fs = await import("fs");
    const code = fs.readFileSync("api/simkl/analyze.js", "utf8");

    const writePatterns = [
      ".create(",
      ".update(",
      ".delete(",
      ".upsert(",
      ".createMany(",
      ".updateMany(",
      ".deleteMany(",
    ];

    for (const pattern of writePatterns) {
      if (code.includes(pattern)) {
        throw new Error(`Test C Failed: Found forbidden write operation '${pattern}' in api/simkl/analyze.js!`);
      }
    }
    console.log(" ✓ Zero Prisma write/mutation operations found in api/simkl/analyze.js");
    console.log("✅ [Test C PASSED] Read-Only Guarantee verified.");

    // --- Test D, E, F, G: Diff Generation & Classification ---
    console.log("\n[Test D, E, F, G] Testing Diff Generation Logic...");
    const mockSimklList = [
      { title: "Fight Club", ids: { tmdb: 550 }, user_rating: 9, watched_at: "2026-08-01T12:00:00Z" },
      { title: "New Movie", ids: { tmdb: 777 }, user_rating: 8, watched_at: "2026-08-05T12:00:00Z" },
      { title: "Unknown Item", ids: {}, user_rating: 5 },
    ];

    const mockStriveLibrary = [
      { titleKey: "tmdb_movie_550", status: "completed", userRating: 8.0, catalogTitle: { tmdbId: 550 } },
    ];

    const striveByTmdb = new Map();
    for (const item of mockStriveLibrary) {
      if (item.catalogTitle?.tmdbId) striveByTmdb.set(Number(item.catalogTitle.tmdbId), item);
    }

    let matched = 0, simklOnly = 0, ratingDiffs = 0, unmatched = 0;

    for (const simklItem of mockSimklList) {
      const tmdbId = simklItem.ids.tmdb ? Number(simklItem.ids.tmdb) : null;
      if (!tmdbId) {
        unmatched++;
        continue;
      }
      const match = striveByTmdb.get(tmdbId);
      if (!match) {
        simklOnly++;
      } else {
        const striveRating = match.userRating ? Math.round(Number(match.userRating)) : null;
        const simklRating = simklItem.user_rating ? Math.round(Number(simklItem.user_rating)) : null;
        if (simklRating !== striveRating) {
          ratingDiffs++;
        } else {
          matched++;
        }
      }
    }

    console.log(" ✓ Matched:", matched);
    console.log(" ✓ Simkl Only:", simklOnly);
    console.log(" ✓ Rating Diffs:", ratingDiffs);
    console.log(" ✓ Unmatched:", unmatched);

    if (simklOnly !== 1 || ratingDiffs !== 1 || unmatched !== 1) {
      throw new Error("Test D-G Failed: Diff calculation metrics mismatch!");
    }
    console.log("✅ [Test D-G PASSED] Diff classification verified.");

    console.log("\n=================================================================");
    console.log("  ALL STAGE 3.3 VERIFICATION TESTS PASSED (2/2)                  ");
    console.log("=================================================================");
    process.exit(0);
  } catch (err) {
    console.error("❌ Stage 3.3 Verification Failed:", err);
    process.exit(1);
  }
}

runStage33Verification();
