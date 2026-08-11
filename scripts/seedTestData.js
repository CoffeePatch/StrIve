import fs from "node:fs";
import dotenv from "dotenv";

if (fs.existsSync(".env.local")) {
  dotenv.config({ path: ".env.local" });
} else {
  dotenv.config();
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("==================================================");
  console.log("Seeding Scaled Test Dataset for Phase 3.3 Benchmarking");
  console.log("==================================================\n");

  const userId = "test_user_1";
  const statusList = ["watching", "completed", "plan_to_watch", "dropped"];
  const genresPool = ["Action", "Adventure", "Comedy", "Drama", "Sci-Fi", "Thriller", "Horror", "Animation"];

  // 1. Ensure test user exists
  await prisma.user.upsert({
    where: { id: userId },
    update: {},
    create: {
      id: userId,
      dashboardPreferences: { showRecentlyAdded: true, defaultView: "grid" },
    },
  });
  console.log(`✅ Ensured user '${userId}' exists.`);

  // 2. Batch seed catalog titles (5,000 titles)
  console.log("⏳ Seeding 5,000 catalog titles...");
  const totalTitles = 5000;
  const batchSize = 1000;

  for (let b = 0; b < totalTitles; b += batchSize) {
    const titleData = [];
    for (let i = b + 1; i <= Math.min(b + batchSize, totalTitles); i++) {
      const isTv = i > 2500;
      const titleKey = isTv ? `tmdb_tv_${i}` : `tmdb_movie_${i}`;
      const genres = [
        genresPool[i % genresPool.length],
        genresPool[(i + 3) % genresPool.length],
      ];

      titleData.push({
        titleKey,
        mediaType: isTv ? "tv" : "movie",
        tmdbId: i,
        imdbId: `tt${1000000 + i}`,
        title: `Sample ${isTv ? "TV Show" : "Movie"} ${i} - ${genres.join(" & ")}`,
        originalTitle: `Original Title ${i}`,
        overview: `Comprehensive overview text description for media item ${i} with detailed plot summaries.`,
        posterPath: `/poster_${i}.jpg`,
        backdropPath: `/backdrop_${i}.jpg`,
        releaseDate: new Date(1990 + (i % 34), (i % 12), (i % 28) + 1),
        showStatus: isTv ? (i % 2 === 0 ? "Returning Series" : "Ended") : null,
        runtimeMinutes: isTv ? 45 : 90 + (i % 60),
        numberOfSeasons: isTv ? 3 : null,
        numberOfEpisodes: isTv ? 21 : null,
        tmdbScore: parseFloat((5.0 + (i % 50) / 10).toFixed(1)),
        tmdbVotes: 100 + (i * 7) % 5000,
        imdbScore: parseFloat((5.2 + (i % 45) / 10).toFixed(1)),
        imdbVotes: 150 + (i * 11) % 8000,
        popularity: parseFloat((10.0 + (i % 900) / 10).toFixed(2)),
        genres,
        networks: isTv ? [{ id: 1, name: "HBO" }] : null,
        lastFetchedAt: new Date(),
      });
    }

    await prisma.catalogTitle.createMany({
      data: titleData,
      skipDuplicates: true,
    });
  }
  console.log("✅ 5,000 Catalog Titles seeded.");

  // 3. Seed seasons & episodes for TV shows (titles 2501..5000)
  console.log("⏳ Seeding ~7,500 seasons and ~52,500 episodes...");
  const seasonData = [];
  const episodeData = [];

  for (let i = 2501; i <= 5000; i++) {
    const titleKey = `tmdb_tv_${i}`;
    for (let s = 1; s <= 3; s++) {
      seasonData.push({
        titleKey,
        seasonNumber: s,
        title: `Season ${s}`,
        overview: `Overview for season ${s} of ${titleKey}`,
        posterPath: `/season_${s}_poster.jpg`,
        airDate: new Date(2010 + s, 1, 1),
        episodeCount: 7,
      });

      for (let e = 1; e <= 7; e++) {
        episodeData.push({
          titleKey,
          seasonNumber: s,
          episodeNumber: e,
          absoluteOrder: (s - 1) * 7 + e,
          title: `Episode ${e}`,
          overview: `Overview for S${s}E${e} of ${titleKey}`,
          stillPath: `/still_s${s}e${e}.jpg`,
          airDate: new Date(2010 + s, 1, 1 + e * 2),
          runtimeMinutes: 45,
          voteAverage: 8.0,
          isAired: true,
        });
      }
    }
  }

  // Batch insert seasons
  for (let i = 0; i < seasonData.length; i += 2000) {
    await prisma.catalogSeason.createMany({
      data: seasonData.slice(i, i + 2000),
      skipDuplicates: true,
    });
  }
  console.log("✅ 7,500 Seasons seeded.");

  // Batch insert episodes
  for (let i = 0; i < episodeData.length; i += 5000) {
    await prisma.catalogEpisode.createMany({
      data: episodeData.slice(i, i + 5000),
      skipDuplicates: true,
    });
  }
  console.log("✅ 52,500 Episodes seeded.");

  // 4. Seed user library items (5,000 items)
  console.log("⏳ Seeding 5,000 user library items...");
  const libraryData = [];
  const now = Date.now();

  for (let i = 1; i <= 5000; i++) {
    const isTv = i > 2500;
    const titleKey = isTv ? `tmdb_tv_${i}` : `tmdb_movie_${i}`;
    const status = statusList[i % statusList.length];

    libraryData.push({
      userId,
      titleKey,
      status,
      userRating: parseFloat((6.0 + (i % 40) / 10).toFixed(1)),
      enrichmentStatus: i % 20 === 0 ? "pending" : "completed",
      addedAt: new Date(now - (5000 - i) * 3600 * 1000),
      lastWatchedAt: status === "watching" || status === "completed" ? new Date(now - (5000 - i) * 1800 * 1000) : null,
    });
  }

  for (let i = 0; i < libraryData.length; i += 1000) {
    await prisma.userLibraryItem.createMany({
      data: libraryData.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
  console.log("✅ 5,000 User Library Items seeded.");

  // 5. Seed episode watch states (~15,000 states)
  console.log("⏳ Seeding ~15,000 user episode states...");
  const episodeStateData = [];

  for (let i = 2501; i <= 5000; i += 2) { // 1250 TV shows
    const titleKey = `tmdb_tv_${i}`;
    for (let s = 1; s <= 2; s++) {
      for (let e = 1; e <= 6; e++) {
        episodeStateData.push({
          userId,
          titleKey,
          seasonNumber: s,
          episodeNumber: e,
          absoluteOrder: (s - 1) * 7 + e,
          state: "watched",
          watchedAt: new Date(now - (i * 1000)),
        });
      }
    }
  }

  for (let i = 0; i < episodeStateData.length; i += 5000) {
    await prisma.userEpisodeState.createMany({
      data: episodeStateData.slice(i, i + 5000),
      skipDuplicates: true,
    });
  }
  console.log("✅ 15,000 User Episode States seeded.");

  // 6. Seed list items (500 list items)
  console.log("⏳ Seeding custom list and 500 list items...");
  const list = await prisma.userList.upsert({
    where: { id: "list_benchmark_1" },
    update: {},
    create: {
      id: "list_benchmark_1",
      userId,
      name: "Benchmark Custom List",
      description: "Top items for benchmarking list order performance",
      kind: "custom",
      visibility: "private",
      itemCount: 500,
    },
  });

  const listItemData = [];
  for (let i = 1; i <= 500; i++) {
    listItemData.push({
      listId: list.id,
      titleKey: `tmdb_movie_${i}`,
      userId,
      position: parseFloat(i.toFixed(4)),
      addedAt: new Date(now - i * 60000),
    });
  }

  await prisma.userListItem.createMany({
    data: listItemData,
    skipDuplicates: true,
  });
  console.log("✅ Custom List and 500 List Items seeded.\n");

  console.log("==================================================");
  console.log("DATASET SEEDING COMPLETE ✅");
  console.log("==================================================");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err);
  prisma.$disconnect();
  process.exit(1);
});
