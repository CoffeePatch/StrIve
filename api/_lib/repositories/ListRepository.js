import prisma from "../prisma.js";

export async function getUserLists({ userId }) {
  return prisma.userList.findMany({
    where: { userId },
    orderBy: [
      { isPinned: "desc" },
      { createdAt: "desc" }
    ],
    include: {
      items: {
        take: 4,
        orderBy: { position: "asc" },
        include: {
          catalog: {
            select: {
              titleKey: true,
              posterPath: true,
              backdropPath: true,
              title: true,
              mediaType: true
            }
          }
        }
      }
    }
  });
}

export async function getListItems({ userId, listId, offset = 0, limit = 50 }) {
  // Enforces user isolation via list.userId matching requested userId
  // Uses offset pagination as per Phase 2.9 contract
  const items = await prisma.userListItem.findMany({
    where: { 
      listId,
      list: { userId } // Only allows access if the list belongs to the user
    },
    orderBy: { position: "asc" },
    skip: offset,
    take: limit,
    include: {
      catalog: true
    }
  });

  return items;
}

export async function createList({ userId, data }) {
  return prisma.userList.create({
    data: {
      userId,
      ...data
    }
  });
}

export async function updateList({ userId, listId, data }) {
  // User isolation checked implicitly if you only update where userId = userId
  return prisma.userList.update({
    where: { id: listId, userId },
    data
  });
}

export async function deleteList({ userId, listId }) {
  // Prisma onDelete: Cascade will delete user_list_items automatically
  return prisma.userList.delete({
    where: { id: listId, userId }
  });
}

export async function addItemsToList({ userId, listId, titleKeys }) {
  // 1. Verify list ownership
  const list = await prisma.userList.findUnique({
    where: { id: listId, userId },
    select: { id: true, itemCount: true }
  });
  if (!list) throw new Error("List not found or unauthorized");

  // 2. Fetch existing items to determine position and avoid duplicates
  const existingItems = await prisma.userListItem.findMany({
    where: { listId },
    select: { titleKey: true, position: true },
    orderBy: { position: "desc" }
  });

  const existingKeys = new Set(existingItems.map(i => i.titleKey));
  let currentMaxPosition = existingItems.length > 0 ? Number(existingItems[0].position) : 0;

  const toAdd = titleKeys.filter(k => !existingKeys.has(k));
  if (toAdd.length === 0) return 0;

  const createData = toAdd.map(titleKey => {
    currentMaxPosition += 1000; // Leaving gaps for future drag-and-drop reordering
    return {
      userId,
      listId,
      titleKey,
      position: currentMaxPosition
    };
  });

  await prisma.userListItem.createMany({
    data: createData
  });

  // 3. Update itemCount
  await prisma.userList.update({
    where: { id: listId },
    data: { itemCount: existingItems.length + toAdd.length }
  });

  return toAdd.length;
}

export async function removeItemsFromList({ userId, listId, titleKeys }) {
  const result = await prisma.userListItem.deleteMany({
    where: { 
      listId,
      userId,
      titleKey: { in: titleKeys }
    }
  });

  if (result.count > 0) {
    // Update itemCount
    const currentCount = await prisma.userListItem.count({ where: { listId } });
    await prisma.userList.update({
      where: { id: listId },
      data: { itemCount: currentCount }
    });
  }

  return result.count;
}

export async function reorderListItem({ userId, listId, titleKey, beforeTitleKey = null, afterTitleKey = null }) {
  // 1. Verify list ownership
  const list = await prisma.userList.findUnique({
    where: { id: listId, userId },
    select: { id: true }
  });
  if (!list) throw new Error("List not found or unauthorized");

  // 2. Fetch list items to determine positions
  const items = await prisma.userListItem.findMany({
    where: { listId },
    select: { titleKey: true, position: true },
    orderBy: { position: "asc" }
  });

  const draggedItem = items.find(i => i.titleKey === titleKey);
  if (!draggedItem) throw new Error("Item not found in list");

  let afterPosition = null;
  let beforePosition = null;

  if (afterTitleKey) {
    const afterItem = items.find(i => i.titleKey === afterTitleKey);
    if (afterItem) afterPosition = Number(afterItem.position);
  }

  if (beforeTitleKey) {
    const beforeItem = items.find(i => i.titleKey === beforeTitleKey);
    if (beforeItem) beforePosition = Number(beforeItem.position);
  }

  // 3. Compute position or trigger renumbering if precision limit is reached
  let newPosition;
  if (afterPosition !== null && beforePosition !== null) {
    const gap = beforePosition - afterPosition;
    if (gap < 0.001) {
      return await renumberAndReorderListItems({ listId, userId, titleKey, afterTitleKey, beforeTitleKey });
    }
    newPosition = (afterPosition + beforePosition) / 2;
  } else if (afterPosition !== null) {
    newPosition = afterPosition + 1000;
  } else if (beforePosition !== null) {
    newPosition = Math.max(0, beforePosition - 1000);
  } else {
    newPosition = 1000;
  }

  // 4. Update row
  await prisma.userListItem.update({
    where: { listId_titleKey: { listId, titleKey } },
    data: { position: newPosition }
  });

  return { success: true, titleKey, newPosition };
}

async function renumberAndReorderListItems({ listId, titleKey, afterTitleKey, beforeTitleKey }) {
  const items = await prisma.userListItem.findMany({
    where: { listId },
    select: { titleKey: true },
    orderBy: { position: "asc" }
  });

  // Re-sequence items array placing titleKey between afterTitleKey and beforeTitleKey
  const remaining = items.map(i => i.titleKey).filter(k => k !== titleKey);
  let insertIdx = remaining.length;

  if (afterTitleKey) {
    const afterIdx = remaining.indexOf(afterTitleKey);
    if (afterIdx !== -1) insertIdx = afterIdx + 1;
  } else if (beforeTitleKey) {
    const beforeIdx = remaining.indexOf(beforeTitleKey);
    if (beforeIdx !== -1) insertIdx = beforeIdx;
  }

  remaining.splice(insertIdx, 0, titleKey);

  // Execute atomic transactional renumbering (1000, 2000, 3000...)
  const updates = remaining.map((k, idx) => {
    const pos = (idx + 1) * 1000;
    return prisma.userListItem.update({
      where: { listId_titleKey: { listId, titleKey: k } },
      data: { position: pos }
    });
  });

  await prisma.$transaction(updates);
  return { success: true, titleKey, renumbered: true };
}

