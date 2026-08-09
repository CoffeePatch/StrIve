import prisma from "../prisma.js";

export async function getLibrary({ userId, status, cursor, limit = 50 }) {
  const where = { userId };
  if (status) {
    where.status = status;
  }

  const items = await prisma.userLibraryItem.findMany({
    where,
    orderBy: { addedAt: "desc" },
    take: limit + 1,
    cursor: cursor ? { userId_titleKey: { userId, titleKey: cursor } } : undefined,
    include: {
      catalogTitle: true,
    }
  });

  let nextCursor = null;
  if (items.length > limit) {
    const nextItem = items.pop();
    nextCursor = nextItem.titleKey;
  }

  return { items, nextCursor };
}

export async function getContinueWatching({ userId, limit = 20 }) {
  // Using query shape from Phase 3.3.1 investigation: early LIMIT subquery
  return prisma.$queryRaw`
    SELECT uli.*, ct.title, ct.poster_path 
    FROM (
      SELECT * FROM user_library_items 
      WHERE user_id = ${userId} AND status = 'watching' 
      ORDER BY last_watched_at DESC NULLS LAST 
      LIMIT ${limit}
    ) uli 
    JOIN catalog_titles ct ON uli.title_key = ct.title_key;
  `;
}

export async function upsertLibraryItem({ userId, titleKey, data }) {
  return prisma.userLibraryItem.upsert({
    where: { userId_titleKey: { userId, titleKey } },
    create: { userId, titleKey, ...data },
    update: { ...data }
  });
}

export async function updateLibraryStatus({ userId, titleKey, status, lastWatchedAt, userRating, notes }) {
  const updateData = {};
  if (status !== undefined && status !== null) {
    updateData.status = status;
  }
  if (lastWatchedAt !== undefined) {
    updateData.lastWatchedAt = lastWatchedAt;
  }
  if (userRating !== undefined) {
    updateData.userRating = userRating;
  }
  if (notes !== undefined) {
    updateData.notes = notes;
  }

  const defaultStatus = status || "plan_to_watch";

  return prisma.userLibraryItem.upsert({
    where: { userId_titleKey: { userId, titleKey } },
    create: {
      userId,
      titleKey,
      status: defaultStatus,
      userRating: userRating !== undefined ? userRating : null,
      lastWatchedAt: lastWatchedAt || null,
      notes: notes !== undefined ? notes : null
    },
    update: updateData
  });
}

export async function deleteLibraryItem({ userId, titleKey }) {
  return prisma.$transaction(async (tx) => {
    await tx.userEpisodeState.deleteMany({
      where: { userId, titleKey }
    });
    
    await tx.userListItem.deleteMany({
      where: { userId, titleKey }
    });
    
    return tx.userLibraryItem.delete({
      where: { userId_titleKey: { userId, titleKey } }
    });
  });
}

export async function batchUpdateLibraryStatus({ userId, titleKeys, status, lastWatchedAt }) {
  const data = { status };
  if (lastWatchedAt !== undefined) {
    data.lastWatchedAt = lastWatchedAt;
  }
  return prisma.userLibraryItem.updateMany({
    where: { userId, titleKey: { in: titleKeys } },
    data
  });
}

export async function batchDeleteLibraryItems({ userId, titleKeys }) {
  return prisma.$transaction(async (tx) => {
    await tx.userEpisodeState.deleteMany({
      where: { userId, titleKey: { in: titleKeys } }
    });
    
    await tx.userListItem.deleteMany({
      where: { userId, titleKey: { in: titleKeys } }
    });
    
    return tx.userLibraryItem.deleteMany({
      where: { userId, titleKey: { in: titleKeys } }
    });
  });
}
