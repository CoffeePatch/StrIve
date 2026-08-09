import prisma from "../prisma.js";

export async function getWatchedEpisodes({ userId, titleKey }) {
  return prisma.userEpisodeState.findMany({
    where: { userId, titleKey, state: "watched" },
    select: { seasonNumber: true, episodeNumber: true }
  });
}

export async function markEpisodeWatched({ userId, titleKey, seasonNumber, episodeNumber, absoluteOrder = null, newStatus = "watching" }) {
  return prisma.$transaction(async (tx) => {
    // 1. Upsert episode state to 'watched'
    await tx.userEpisodeState.upsert({
      where: { userId_titleKey_seasonNumber_episodeNumber: { userId, titleKey, seasonNumber, episodeNumber } },
      create: { userId, titleKey, seasonNumber, episodeNumber, absoluteOrder, state: "watched", watchedAt: new Date() },
      update: { state: "watched", watchedAt: new Date() }
    });

    // 2. Update library item timestamp and status atomically
    await tx.userLibraryItem.upsert({
      where: { userId_titleKey: { userId, titleKey } },
      create: { userId, titleKey, status: newStatus, lastWatchedAt: new Date() },
      update: { status: newStatus, lastWatchedAt: new Date() }
    });
  });
}

export async function unwatchEpisode({ userId, titleKey, seasonNumber, episodeNumber, fallbackStatus = "plan_to_watch" }) {
  return prisma.$transaction(async (tx) => {
    // 1. Delete the episode state
    await tx.userEpisodeState.deleteMany({
      where: { userId, titleKey, seasonNumber, episodeNumber }
    });

    // 2. Find the remaining most recently watched episode
    const remaining = await tx.userEpisodeState.findFirst({
      where: { userId, titleKey, state: "watched" },
      orderBy: { watchedAt: "desc" }
    });

    // 3. Update library item accordingly
    if (remaining) {
      // The user still has watched episodes. We might need to revert from 'completed' to 'watching',
      // but if fallbackStatus is provided, we use it (e.g. 'watching' since not all are watched now).
      await tx.userLibraryItem.updateMany({
        where: { userId, titleKey },
        data: { status: fallbackStatus, lastWatchedAt: remaining.watchedAt }
      });
    } else {
      await tx.userLibraryItem.updateMany({
        where: { userId, titleKey },
        data: { 
          lastWatchedAt: null,
          status: "plan_to_watch"
        }
      });
    }
  });
}

export async function unwatchAllEpisodes({ userId, titleKey }) {
  return prisma.$transaction(async (tx) => {
    // 1. Delete all episode states for this series
    await tx.userEpisodeState.deleteMany({
      where: { userId, titleKey }
    });

    // 2. Update library item to reset watch status
    await tx.userLibraryItem.updateMany({
      where: { userId, titleKey },
      data: { 
        lastWatchedAt: null,
        status: "plan_to_watch"
      }
    });
  });
}

export async function markSeasonWatched({ userId, titleKey, seasonNumber, episodes, newStatus = "watching" }) {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    // 1. Upsert episode state for all episodes in the season
    for (const ep of episodes) {
      await tx.userEpisodeState.upsert({
        where: { userId_titleKey_seasonNumber_episodeNumber: { userId, titleKey, seasonNumber, episodeNumber: ep.episodeNumber } },
        create: { userId, titleKey, seasonNumber, episodeNumber: ep.episodeNumber, absoluteOrder: ep.absoluteOrder || null, state: "watched", watchedAt: now },
        update: { state: "watched", watchedAt: now }
      });
    }

    // 2. Update library item timestamp and status atomically
    await tx.userLibraryItem.upsert({
      where: { userId_titleKey: { userId, titleKey } },
      create: { userId, titleKey, status: newStatus, lastWatchedAt: now },
      update: { status: newStatus, lastWatchedAt: now }
    });
  });
}

export async function unwatchSeason({ userId, titleKey, seasonNumber, fallbackStatus = "plan_to_watch" }) {
  return prisma.$transaction(async (tx) => {
    // 1. Delete all episode states for this season
    await tx.userEpisodeState.deleteMany({
      where: { userId, titleKey, seasonNumber }
    });

    // 2. Find remaining most recently watched episode across all seasons
    const remaining = await tx.userEpisodeState.findFirst({
      where: { userId, titleKey, state: "watched" },
      orderBy: { watchedAt: "desc" }
    });

    // 3. Update library item accordingly
    if (remaining) {
      await tx.userLibraryItem.updateMany({
        where: { userId, titleKey },
        data: { status: fallbackStatus, lastWatchedAt: remaining.watchedAt }
      });
    } else {
      await tx.userLibraryItem.updateMany({
        where: { userId, titleKey },
        data: { 
          lastWatchedAt: null,
          status: "plan_to_watch"
        }
      });
    }
  });
}
