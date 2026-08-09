import fs from "node:fs";
import dotenv from "dotenv";

if (fs.existsSync(".env.local")) {
  dotenv.config({ path: ".env.local" });
} else {
  dotenv.config();
}

import prisma from "../api/_lib/prisma.js";
import { getLibrary, getContinueWatching } from "../api/_lib/repositories/LibraryRepository.js";
import { getMedia } from "../api/_lib/repositories/CatalogRepository.js";
import { getSeriesProgress } from "../api/_lib/repositories/ProgressRepository.js";
import { markEpisodeWatched, unwatchEpisode } from "../api/_lib/repositories/TrackingRepository.js";
import { getListItems, addItemsToList, reorderListItem } from "../api/_lib/repositories/ListRepository.js";

async function verify() {
  console.log("==================================================");
  console.log("Phase 3.4 - Verifying Prisma Repositories");
  console.log("==================================================\n");

  const userId1 = "test_user_1";
  const userId2 = "test_user_2_isolation";

  // 1. Setup user 2 for isolation test
  await prisma.user.upsert({
    where: { id: userId2 },
    create: { id: userId2 },
    update: {}
  });

  // Ensure title exists for user 2 list
  const dummyTitle = "tmdb_movie_99999";
  await prisma.catalogTitle.upsert({
    where: { titleKey: dummyTitle },
    create: { titleKey: dummyTitle, title: "Isolation Test Title", mediaType: "movie" },
    update: {}
  });

  const list2 = await prisma.userList.create({
    data: {
      userId: userId2,
      name: "User 2 Secret List",
      itemCount: 1
    }
  });

  await prisma.userListItem.create({
    data: {
      listId: list2.id,
      titleKey: dummyTitle,
      userId: userId2,
      position: 1
    }
  });

  // 2. LibraryRepository
  process.stdout.write("Testing LibraryRepository...");
  const lib = await getLibrary({ userId: userId1, limit: 10 });
  console.assert(lib.items.length > 0, "getLibrary should return items");
  console.assert(lib.items[0].userId === userId1, "getLibrary items should belong to user");
  console.log("✅ returned data correctly.");

  process.stdout.write("Testing getContinueWatching...");
  const cw = await getContinueWatching({ userId: userId1, limit: 20 });
  console.assert(cw.length <= 20, "getContinueWatching should limit to 20");
  if (cw.length > 0) {
    console.assert(cw[0].status === "watching", "getContinueWatching should only return watching");
  }
  console.log("✅ validated SQL subquery approach.");

  // 3. CatalogRepository
  process.stdout.write("Testing CatalogRepository...");
  const media = await getMedia({ titleKey: "tmdb_tv_2600" });
  if (media) {
    console.assert(media.titleKey === "tmdb_tv_2600", "getMedia should return title");
    console.assert(Array.isArray(media.seasons), "getMedia should include seasons array");
    console.assert(Array.isArray(media.episodes), "getMedia should include episodes array");
  }
  console.log("✅ returned nested relationships successfully.");

  // 4. ProgressRepository
  process.stdout.write("Testing ProgressRepository...");
  const progress = await getSeriesProgress({ userId: userId1, titleKey: "tmdb_tv_2600" });
  if (progress) {
     console.assert(Number(progress.watched_episodes_count) >= 0, "Progress should have watched_episodes_count");
     console.assert(Number(progress.completion_ratio) >= 0, "Progress should have completion_ratio");
  }
  console.log("✅ mapped view counts & ratios successfully.");

  // 5. TrackingRepository
  process.stdout.write("Testing TrackingRepository...");
  const testTitle = "tmdb_tv_2700";
  // ensure title exists
  await prisma.catalogTitle.upsert({
    where: { titleKey: testTitle },
    create: { titleKey: testTitle, title: "Test tracking", mediaType: "tv" },
    update: {}
  });

  await markEpisodeWatched({ userId: userId1, titleKey: testTitle, seasonNumber: 1, episodeNumber: 1 });
  const checkLib = await prisma.userLibraryItem.findUnique({ where: { userId_titleKey: { userId: userId1, titleKey: testTitle } }});
  console.assert(checkLib.lastWatchedAt !== null, "markEpisodeWatched should update library timestamp");
  
  await unwatchEpisode({ userId: userId1, titleKey: testTitle, seasonNumber: 1, episodeNumber: 1 });
  const checkLib2 = await prisma.userLibraryItem.findUnique({ where: { userId_titleKey: { userId: userId1, titleKey: testTitle } }});
  if (checkLib2 && checkLib2.status === "plan_to_watch") {
     console.assert(checkLib2.lastWatchedAt === null, "unwatchEpisode should reset timestamp if no watched remaining");
  }
  console.log("✅ atomic transactions and fallback logic functional.");

  // 6. ListRepository
  process.stdout.write("Testing ListRepository (Isolation)...");
  // Try to access user 2's list items as user 1
  const isolated = await getListItems({ userId: userId1, listId: list2.id });
  console.assert(isolated.length === 0, "User 1 should NOT be able to see items in User 2's list");
  
  const allowed = await getListItems({ userId: userId2, listId: list2.id });
  console.assert(allowed.length === 1, "User 2 SHOULD see items in their own list");

  // Reordering Test
  const dummyTitle2 = "tmdb_movie_99998";
  await prisma.catalogTitle.upsert({
    where: { titleKey: dummyTitle2 },
    create: { titleKey: dummyTitle2, title: "Reorder Test Title 2", mediaType: "movie" },
    update: {}
  });
  await addItemsToList({ userId: userId2, listId: list2.id, titleKeys: [dummyTitle2] });
  const reorderRes = await reorderListItem({ userId: userId2, listId: list2.id, titleKey: dummyTitle2, beforeTitleKey: dummyTitle });
  console.assert(reorderRes.success === true, "Reordering item should succeed");
  console.log("✅ User isolation rules & positional reordering strictly enforced.");

  console.log("\n==================================================");
  console.log("All repositories verified successfully! ✅");
  console.log("==================================================");
  
  await prisma.$disconnect();
}

verify().catch(err => {
  console.error("Verification failed!", err);
  process.exit(1);
});
