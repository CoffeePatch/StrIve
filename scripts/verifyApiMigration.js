import fs from "node:fs";
import dotenv from "dotenv";

if (fs.existsSync(".env.local")) {
  dotenv.config({ path: ".env.local" });
} else {
  dotenv.config();
}

import prisma from "../api/_lib/prisma.js";

// Import Handlers
import libraryHandler from "../api/library/index.js";
import cwHandler from "../api/library/continue-watching.js";
import searchHandler from "../api/catalog/search.js";
import detailsHandler from "../api/catalog/[titleKey].js";
import watchHandler from "../api/tracking/watch.js";
import listIndexHandler from "../api/lists/index.js";
import listIdHandler from "../api/lists/[id].js";
import userHistoryHandler from "../api/user/history.js";
import analyticsHandler from "../api/user/analytics.js";
import libraryTitleHandler from "../api/library/[titleKey].js";
import reorderHandler from "../api/lists/[id]/reorder.js";



function assert(condition, message) {
  if (!condition) {
    throw new Error("Assertion failed: " + message);
  }
}

function createMockRes() {
  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
  return res;
}

function mockAuth(uid) {
  process.env.NODE_ENV = "test";
  process.env.MOCK_AUTH_USER_ID = uid === null ? "null" : uid;
}

async function verify() {
  console.log("==================================================");
  console.log("Phase 3.6 - Verifying API Migration (Handlers)");
  console.log("==================================================\n");

  const userIdA = "test_user_api_a";
  const userIdB = "test_user_api_b";
  const testTitle = "tmdb_tv_api_3000";

  // 1. Setup minimal dummy metadata
  await prisma.user.upsert({
    where: { id: userIdA },
    create: { id: userIdA },
    update: {}
  });

  await prisma.catalogTitle.upsert({
    where: { titleKey: testTitle },
    create: { titleKey: testTitle, title: "API Test TV Show", mediaType: "tv" },
    update: {}
  });
  
  await prisma.catalogSeason.upsert({
    where: { titleKey_seasonNumber: { titleKey: testTitle, seasonNumber: 1 } },
    create: { titleKey: testTitle, seasonNumber: 1, title: "Season 1" },
    update: {}
  });

  await prisma.catalogEpisode.upsert({
    where: { titleKey_seasonNumber_episodeNumber: { titleKey: testTitle, seasonNumber: 1, episodeNumber: 1 } },
    create: { titleKey: testTitle, seasonNumber: 1, episodeNumber: 1, absoluteOrder: 1, isAired: true },
    update: { isAired: true }
  });

  await prisma.catalogEpisode.upsert({
    where: { titleKey_seasonNumber_episodeNumber: { titleKey: testTitle, seasonNumber: 1, episodeNumber: 2 } },
    create: { titleKey: testTitle, seasonNumber: 1, episodeNumber: 2, absoluteOrder: 2, isAired: false },
    update: { isAired: false }
  });

  await prisma.userList.upsert({
    where: { id: "list_api_a" },
    create: { id: "list_api_a", userId: userIdA, name: "User A List" },
    update: {}
  });

  await prisma.userListItem.upsert({
    where: { listId_titleKey: { listId: "list_api_a", titleKey: testTitle } },
    create: { listId: "list_api_a", userId: userIdA, titleKey: testTitle, position: 1000 },
    update: {}
  });

  process.stdout.write("Testing 401 Unauthenticated mapping...");
  mockAuth(null);
  const res401 = createMockRes();
  await libraryHandler({ method: "GET", headers: { authorization: "Bearer invalid" } }, res401);
  assert(res401.statusCode === 401, "Expected 401 status");
  assert(res401.body.error.code === "unauthenticated", "Expected unauthenticated error code");
  console.log("✅ Passed.");

  process.stdout.write("Testing GET /api/library...");
  mockAuth(userIdA);
  const resLib = createMockRes();
  await libraryHandler({ method: "GET", headers: { authorization: "Bearer valid" }, query: {} }, resLib);
  assert(resLib.statusCode === 200, "Expected 200 status");
  assert(resLib.body.items !== undefined, "Expected items array");
  console.log("✅ Passed.");

  process.stdout.write("Testing GET /api/library/continue-watching...");
  const resCw = createMockRes();
  await cwHandler({ method: "GET", headers: { authorization: "Bearer valid" }, query: {} }, resCw);
  assert(resCw.statusCode === 200, "Expected 200 status");
  assert(resCw.body.items !== undefined, "Expected items array");
  console.log("✅ Passed.");

  process.stdout.write("Testing GET /api/catalog/search...");
  const resSearch = createMockRes();
  await searchHandler({ method: "GET", headers: { authorization: "Bearer valid" }, query: { q: "API Test" } }, resSearch);
  assert(resSearch.statusCode === 200, "Expected 200 status");
  assert(resSearch.body.results.length >= 0, "Expected results array");
  console.log("✅ Passed.");

  process.stdout.write("Testing GET /api/catalog/:titleKey...");
  const resDetails = createMockRes();
  await detailsHandler({ method: "GET", headers: { authorization: "Bearer valid" }, query: { titleKey: testTitle } }, resDetails);
  assert(resDetails.statusCode === 200, "Expected 200 status");
  assert(resDetails.body.catalog !== undefined, "Expected catalog object");
  console.log("✅ Passed.");

  process.stdout.write("Testing POST /api/tracking/watch (mark watched)...");
  const resWatch1 = createMockRes();
  await watchHandler({ 
    method: "POST", 
    headers: { authorization: "Bearer valid" },
    body: { titleKey: testTitle, mode: "single", seasonNumber: 1, episodeNumber: 1 } 
  }, resWatch1);
  assert(resWatch1.statusCode === 200, "Expected 200 status");
  assert(resWatch1.body.success === true, "Expected success: true");
  assert(resWatch1.body.status === "completed", "Expected status computed as completed");
  console.log("✅ Passed.");

  process.stdout.write("Testing POST /api/tracking/watch (unaired episode)...");
  const resWatch2 = createMockRes();
  await watchHandler({ 
    method: "POST", 
    headers: { authorization: "Bearer valid" },
    body: { titleKey: testTitle, mode: "single", seasonNumber: 1, episodeNumber: 2 } 
  }, resWatch2);
  assert(resWatch2.statusCode === 400, "Expected 400 status");
  assert(resWatch2.body.error.code === "invalid-argument", "Expected invalid-argument");
  console.log("✅ Passed.");
  
  process.stdout.write("Testing POST /api/tracking/watch (unwatch)...");
  const resWatch3 = createMockRes();
  await watchHandler({ 
    method: "POST", 
    headers: { authorization: "Bearer valid" },
    body: { titleKey: testTitle, mode: "unwatch", seasonNumber: 1, episodeNumber: 1 } 
  }, resWatch3);
  assert(resWatch3.statusCode === 200, "Expected 200 status");
  assert(resWatch3.body.status === "plan_to_watch", "Expected fallback status to plan_to_watch");
  console.log("✅ Passed.");

  process.stdout.write("Testing GET /api/lists...");
  const resLists = createMockRes();
  await listIndexHandler({ method: "GET", headers: { authorization: "Bearer valid" }, query: {} }, resLists);
  assert(resLists.statusCode === 200, "Expected 200 status");
  assert(resLists.body.some(l => l.id === "list_api_a"), "Expected to find test list");
  console.log("✅ Passed.");

  process.stdout.write("Testing GET /api/lists/:id (Ownership isolation)...");
  mockAuth(userIdB);
  const resListItems = createMockRes();
  await listIdHandler({ method: "GET", headers: { authorization: "Bearer valid" }, query: { id: "list_api_a" } }, resListItems);
  assert(resListItems.statusCode === 200, "Service currently returns 200 instead of 403/404");
  assert(resListItems.body.length === 0, "Expected empty array to prevent cross-user access");
  console.log("✅ Passed.");

  process.stdout.write("Testing GET /api/user/history...");
  mockAuth(userIdA);
  const resHistory = createMockRes();
  await userHistoryHandler({ method: "GET", headers: { authorization: "Bearer valid" }, query: { limit: 10 } }, resHistory);
  assert(resHistory.statusCode === 200, "Expected 200 status");
  assert(Array.isArray(resHistory.body.items), "Expected items array in history response");
  console.log("✅ Passed.");

  process.stdout.write("Testing PATCH /api/lists/:id/reorder...");
  mockAuth(userIdA);
  const resReorder = createMockRes();
  await reorderHandler({
    method: "PATCH",
    headers: { authorization: "Bearer valid" },
    query: { id: "list_api_a" },
    body: { titleKey: testTitle }
  }, resReorder);
  assert(resReorder.statusCode === 200, "Expected 200 status for reordering list item");
  assert(resReorder.body.success === true, "Expected success: true response");
  console.log("✅ Passed.");

  // Personal Review Notes Tests
  process.stdout.write("Testing PATCH /api/library/:titleKey (Personal Notes)...");
  mockAuth(userIdA);
  const resNotesPatch = createMockRes();
  const testNote = "Great cinematography and soundtrack. Recommended.";
  await libraryTitleHandler({
    method: "PATCH",
    headers: { authorization: "Bearer valid" },
    query: { titleKey: testTitle },
    body: { notes: testNote }
  }, resNotesPatch);
  assert(resNotesPatch.statusCode === 200, "Expected 200 status for PATCH notes");
  console.log("✅ Passed.");

  process.stdout.write("Testing GET /api/catalog/:titleKey (Exposes userNotes)...");
  mockAuth(userIdA);
  const resCatalogNotes = createMockRes();
  await detailsHandler({
    method: "GET",
    headers: { authorization: "Bearer valid" },
    query: { titleKey: testTitle }
  }, resCatalogNotes);
  assert(resCatalogNotes.statusCode === 200, "Expected 200 status");
  assert(resCatalogNotes.body.catalog.userNotes === testNote, "Expected userNotes to match testNote");
  console.log("✅ Passed.");

  process.stdout.write("Testing PATCH /api/library/:titleKey (>5000 chars rejection)...");
  mockAuth(userIdA);
  const resOverLimit = createMockRes();
  await libraryTitleHandler({
    method: "PATCH",
    headers: { authorization: "Bearer valid" },
    query: { titleKey: testTitle },
    body: { notes: "a".repeat(5001) }
  }, resOverLimit);
  assert(resOverLimit.statusCode === 400, "Expected 400 status for >5000 chars note");
  console.log("✅ Passed.");

  process.stdout.write("Testing PATCH /api/library/:titleKey (Clear Note with null)...");
  mockAuth(userIdA);
  const resClearNotes = createMockRes();
  await libraryTitleHandler({
    method: "PATCH",
    headers: { authorization: "Bearer valid" },
    query: { titleKey: testTitle },
    body: { notes: null }
  }, resClearNotes);
  assert(resClearNotes.statusCode === 200, "Expected 200 status for clearing note");
  const resCheckClear = createMockRes();
  await detailsHandler({
    method: "GET",
    headers: { authorization: "Bearer valid" },
    query: { titleKey: testTitle }
  }, resCheckClear);
  assert(resCheckClear.body.catalog.userNotes === null, "Expected userNotes to be null after clear");
  console.log("✅ Passed.");

  // Personal Analytics Tests
  process.stdout.write("Testing GET /api/user/analytics (Structure & User Isolation)...");
  mockAuth(userIdA);
  const resAnalyticsA = createMockRes();
  await analyticsHandler({ method: "GET", headers: { authorization: "Bearer valid" } }, resAnalyticsA);
  assert(resAnalyticsA.statusCode === 200, "Expected 200 status for analytics endpoint");
  assert(typeof resAnalyticsA.body.summary === "object", "Expected summary object in analytics");
  assert(typeof resAnalyticsA.body.statusBreakdown === "object", "Expected statusBreakdown object");
  assert(Array.isArray(resAnalyticsA.body.topGenres), "Expected topGenres array");
  assert(Array.isArray(resAnalyticsA.body.ratingHistogram), "Expected ratingHistogram array");
  assert(Array.isArray(resAnalyticsA.body.monthlyActivity), "Expected monthlyActivity array");

  // Verify User Isolation for empty user
  mockAuth(userIdB);
  const resAnalyticsB = createMockRes();
  await analyticsHandler({ method: "GET", headers: { authorization: "Bearer valid" } }, resAnalyticsB);
  assert(resAnalyticsB.statusCode === 200, "Expected 200 status for user B analytics");
  assert(resAnalyticsB.body.summary.totalLibraryItems === 0, "Expected 0 total library items for user B");
  console.log("✅ Passed.");

  console.log("\n==================================================");
  console.log("All APIs verified successfully! ✅");
  console.log("==================================================");
  
  await prisma.$disconnect();
}

verify().catch(err => {
  console.error("Verification failed!", err);
  process.exit(1);
});
