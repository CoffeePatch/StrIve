import prisma from "../prisma.js";

export async function getUserPreferences({ userId }) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dashboardPreferences: true }
  });
  return user?.dashboardPreferences || {};
}

export async function updateUserPreferences({ userId, preferences }) {
  const user = await prisma.user.upsert({
    where: { id: userId },
    update: {
      dashboardPreferences: preferences
    },
    create: {
      id: userId,
      dashboardPreferences: preferences
    }
  });
  return user.dashboardPreferences;
}

export async function getUserWatchHistory({ userId, limit = 50, offset = 0 }) {
  // 1. Fetch TV episode watch states
  const episodeStates = await prisma.userEpisodeState.findMany({
    where: { userId, state: "watched" },
    orderBy: { watchedAt: "desc" },
    skip: offset,
    take: limit,
    include: {
      catalogTitle: {
        select: {
          titleKey: true,
          title: true,
          mediaType: true,
          tmdbId: true,
          posterPath: true,
        }
      },
      catalogEpisode: {
        select: {
          title: true,
          stillPath: true
        }
      }
    }
  });

  // 2. Fetch completed movies / items with lastWatchedAt
  const movieItems = await prisma.userLibraryItem.findMany({
    where: {
      userId,
      lastWatchedAt: { not: null },
      catalogTitle: { mediaType: "movie" }
    },
    orderBy: { lastWatchedAt: "desc" },
    skip: offset,
    take: limit,
    include: {
      catalogTitle: {
        select: {
          titleKey: true,
          title: true,
          mediaType: true,
          tmdbId: true,
          posterPath: true,
        }
      }
    }
  });

  // 3. Map into normalized activity events
  const episodeActivities = episodeStates.map(ep => ({
    id: `ep_${ep.titleKey}_${ep.seasonNumber}_${ep.episodeNumber}`,
    activityType: "episode_watched",
    mediaType: "tv",
    titleKey: ep.titleKey,
    tmdbId: ep.catalogTitle?.tmdbId || Number(ep.titleKey.replace(/^tmdb_tv_/, '')),
    title: ep.catalogTitle?.title || "TV Show",
    posterPath: ep.catalogTitle?.posterPath || null,
    seasonNumber: ep.seasonNumber,
    episodeNumber: ep.episodeNumber,
    episodeTitle: ep.catalogEpisode?.title || `Episode ${ep.episodeNumber}`,
    watchedAt: ep.watchedAt
  }));

  const movieActivities = movieItems.map(m => ({
    id: `movie_${m.titleKey}`,
    activityType: "movie_watched",
    mediaType: "movie",
    titleKey: m.titleKey,
    tmdbId: m.catalogTitle?.tmdbId || Number(m.titleKey.replace(/^tmdb_movie_/, '')),
    title: m.catalogTitle?.title || "Movie",
    posterPath: m.catalogTitle?.posterPath || null,
    userRating: m.userRating ? Number(m.userRating) : null,
    watchedAt: m.lastWatchedAt
  }));

  // 4. Merge, sort newest first, and take limit
  const combined = [...episodeActivities, ...movieActivities]
    .sort((a, b) => new Date(b.watchedAt) - new Date(a.watchedAt))
    .slice(0, limit);

  const hasMore = (episodeStates.length >= limit) || (movieItems.length >= limit);
  const nextCursor = hasMore ? offset + limit : null;

  return { items: combined, nextCursor };
}

export async function getUserAnalytics({ userId }) {
  const [libraryItems, episodeCount, episodeActivities, movieActivities] = await Promise.all([
    // 1. Fetch library items with minimal fields for status, ratings, runtimes, genres
    prisma.userLibraryItem.findMany({
      where: { userId },
      select: {
        status: true,
        userRating: true,
        lastWatchedAt: true,
        catalogTitle: {
          select: {
            mediaType: true,
            runtimeMinutes: true,
            genres: true
          }
        }
      }
    }),
    // 2. Count total watched episodes
    prisma.userEpisodeState.count({
      where: { userId, state: "watched" }
    }),
    // 3. Fetch recent episode watchedAt timestamps for monthly activity
    prisma.userEpisodeState.findMany({
      where: { userId, state: "watched" },
      select: { watchedAt: true },
      orderBy: { watchedAt: "desc" },
      take: 2000
    }),
    // 4. Fetch recent movie lastWatchedAt timestamps for monthly activity
    prisma.userLibraryItem.findMany({
      where: {
        userId,
        lastWatchedAt: { not: null },
        catalogTitle: { mediaType: "movie" }
      },
      select: { lastWatchedAt: true },
      orderBy: { lastWatchedAt: "desc" },
      take: 1000
    })
  ]);

  // Status Breakdown & Media Types
  const statusCounts = { completed: 0, watching: 0, plan_to_watch: 0, dropped: 0 };
  let moviesCount = 0;
  let tvCount = 0;
  let totalWatchedMovies = 0;

  let totalMovieMinutes = 0;
  let totalRatingsSum = 0;
  let ratedItemsCount = 0;
  const ratingMap = {};
  const genreMap = {};

  // Initialize rating histogram map (1.0 to 10.0 in 0.5 steps)
  for (let r = 10; r >= 1; r -= 0.5) {
    ratingMap[r.toFixed(1)] = 0;
  }

  for (const item of libraryItems) {
    const status = item.status || "plan_to_watch";
    if (statusCounts[status] !== undefined) {
      statusCounts[status]++;
    }

    const mediaType = item.catalogTitle?.mediaType;
    if (mediaType === "movie") {
      moviesCount++;
      if (status === "completed" || item.lastWatchedAt) {
        totalWatchedMovies++;
        const runtime = item.catalogTitle?.runtimeMinutes || 100;
        totalMovieMinutes += runtime;
      }
    } else if (mediaType === "tv") {
      tvCount++;
    }

    // User Ratings
    if (item.userRating !== null && item.userRating !== undefined) {
      const numRating = Number(item.userRating);
      totalRatingsSum += numRating;
      ratedItemsCount++;
      const key = numRating.toFixed(1);
      if (ratingMap[key] !== undefined) {
        ratingMap[key]++;
      }
    }

    // Genres
    const genres = item.catalogTitle?.genres || [];
    for (const g of genres) {
      if (g) {
        genreMap[g] = (genreMap[g] || 0) + 1;
      }
    }
  }

  // Estimated TV episode watch time (average 45 minutes per episode if episode runtime unavailable)
  const totalTvEpisodeMinutes = episodeCount * 45;
  const totalWatchTimeMinutes = totalMovieMinutes + totalTvEpisodeMinutes;
  const totalWatchTimeHours = Math.round(totalWatchTimeMinutes / 60);
  const totalWatchTimeDays = Number((totalWatchTimeMinutes / 1440).toFixed(1));
  const meanUserRating = ratedItemsCount > 0 ? Number((totalRatingsSum / ratedItemsCount).toFixed(1)) : null;

  // Format Top Genres (Top 6)
  const topGenres = Object.entries(genreMap)
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // Format Rating Histogram
  const ratingHistogram = Object.entries(ratingMap)
    .map(([rating, count]) => ({ rating: Number(rating), count }))
    .filter(r => r.count > 0 || [10.0, 9.0, 8.0, 7.0, 6.0].includes(r.rating));

  // Compute Monthly Watch Activity (Past 6 Months)
  const monthCounts = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthCounts[monthKey] = 0;
  }

  for (const ep of episodeActivities) {
    if (!ep.watchedAt) continue;
    const d = new Date(ep.watchedAt);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (monthCounts[monthKey] !== undefined) {
      monthCounts[monthKey]++;
    }
  }

  for (const m of movieActivities) {
    if (!m.lastWatchedAt) continue;
    const d = new Date(m.lastWatchedAt);
    const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (monthCounts[monthKey] !== undefined) {
      monthCounts[monthKey]++;
    }
  }

  const monthlyActivity = Object.entries(monthCounts).map(([month, count]) => ({ month, count }));

  return {
    summary: {
      totalLibraryItems: libraryItems.length,
      moviesCount,
      tvCount,
      totalWatchedMovies,
      totalEpisodesWatched: episodeCount,
      totalWatchTimeMinutes,
      totalWatchTimeHours,
      totalWatchTimeDays,
      meanUserRating,
      ratedItemsCount
    },
    statusBreakdown: statusCounts,
    topGenres,
    ratingHistogram,
    monthlyActivity
  };
}

