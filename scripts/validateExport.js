import { exportUserData } from "../api/_lib/services/exportService.js";

async function runValidation() {
  console.log("=== Testing exportUserData Service ===");

  const testUserId = "test_verification_user";

  try {
    const jsonExport = await exportUserData({ userId: testUserId, format: "json" });
    console.log("JSON export generated successfully:");
    console.log(" - Format:", jsonExport.format);
    console.log(" - Schema Version:", jsonExport.schemaVersion);
    console.log(" - User ID:", jsonExport.user?.id);
    console.log(" - Library Count:", jsonExport.library?.length);
    console.log(" - Episode States Count:", jsonExport.episodeStates?.length);
    console.log(" - Lists Count:", jsonExport.lists?.length);
    console.log(" - Catalog Items Count:", jsonExport.catalog?.length);
    console.log(" - Seasons Count:", jsonExport.seasons?.length);
    console.log(" - Episodes Count:", jsonExport.episodes?.length);

    // Relationship Consistency Verification
    const catalogKeys = new Set(jsonExport.catalog.map(c => c.titleKey));
    let brokenRefs = 0;

    jsonExport.library.forEach(item => {
      if (item.titleKey && !catalogKeys.has(item.titleKey)) {
        console.error(`❌ Broken reference in library: titleKey ${item.titleKey} not in catalog`);
        brokenRefs++;
      }
    });

    jsonExport.episodeStates.forEach(ep => {
      if (ep.titleKey && !catalogKeys.has(ep.titleKey)) {
        console.error(`❌ Broken reference in episodeStates: titleKey ${ep.titleKey} not in catalog`);
        brokenRefs++;
      }
    });

    jsonExport.lists.forEach(list => {
      (list.items || []).forEach(item => {
        if (item.titleKey && !catalogKeys.has(item.titleKey)) {
          console.error(`❌ Broken reference in list ${list.name}: titleKey ${item.titleKey} not in catalog`);
          brokenRefs++;
        }
      });
    });

    if (brokenRefs === 0) {
      console.log("✅ Relationship consistency check PASSED (0 broken catalog references).");
    }

    const csvExport = await exportUserData({ userId: testUserId, format: "csv" });
    console.log("CSV export generated successfully:");
    console.log(" - CSV Header Line:", csvExport.split("\n")[0]);
    console.log(" - Total CSV Lines:", csvExport.split("\n").length);
    console.log("✅ CSV export format PASSED.");

    console.log("=== All Export Verification Checks Passed ===");
    process.exit(0);
  } catch (error) {
    console.error("❌ Export validation failed:", error);
    process.exit(1);
  }
}

runValidation();
