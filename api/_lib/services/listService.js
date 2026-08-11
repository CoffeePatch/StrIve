import * as listRepository from "../repositories/ListRepository.js";
import { ServiceError } from "./libraryService.js";

export async function getUserLists(userId) {
  if (!userId) throw new ServiceError(401, "Unauthenticated");
  return listRepository.getUserLists({ userId });
}

export async function getListItems(userId, listId, options = {}) {
  if (!userId) throw new ServiceError(401, "Unauthenticated");
  if (!listId) throw new ServiceError(400, "List ID is required");

  // Offset pagination
  const offset = Number(options.offset) || 0;
  const limit = Number(options.limit) || 50;

  return listRepository.getListItems({ userId, listId, offset, limit });
}

export async function createList(userId, data) {
  if (!userId) throw new ServiceError(401, "Unauthenticated");
  if (!data.name) throw new ServiceError(400, "Name is required");

  return listRepository.createList({ userId, data: { name: data.name, description: data.description } });
}

export async function updateList(userId, listId, data) {
  if (!userId) throw new ServiceError(401, "Unauthenticated");
  if (!listId) throw new ServiceError(400, "List ID is required");

  const validUpdates = {};
  if (data.name !== undefined) validUpdates.name = data.name;
  if (data.description !== undefined) validUpdates.description = data.description;
  if (data.isPinned !== undefined) validUpdates.isPinned = data.isPinned;

  if (Object.keys(validUpdates).length === 0) {
    throw new ServiceError(400, "No valid update fields provided");
  }

  return listRepository.updateList({ userId, listId, data: validUpdates });
}

export async function deleteList(userId, listId) {
  if (!userId) throw new ServiceError(401, "Unauthenticated");
  if (!listId) throw new ServiceError(400, "List ID is required");

  return listRepository.deleteList({ userId, listId });
}

export async function addItemsToList(userId, listId, titleKeys) {
  if (!userId) throw new ServiceError(401, "Unauthenticated");
  if (!listId) throw new ServiceError(400, "List ID is required");
  if (!Array.isArray(titleKeys) || titleKeys.length === 0) {
    throw new ServiceError(400, "titleKeys array is required");
  }

  return listRepository.addItemsToList({ userId, listId, titleKeys });
}

export async function removeItemsFromList(userId, listId, titleKeys) {
  if (!userId) throw new ServiceError(401, "Unauthenticated");
  if (!listId) throw new ServiceError(400, "List ID is required");
  if (!Array.isArray(titleKeys) || titleKeys.length === 0) {
    throw new ServiceError(400, "titleKeys array is required");
  }

  return listRepository.removeItemsFromList({ userId, listId, titleKeys });
}

export async function reorderListItem(userId, listId, data = {}) {
  if (!userId) throw new ServiceError(401, "Unauthenticated");
  if (!listId) throw new ServiceError(400, "List ID is required");
  if (!data.titleKey) throw new ServiceError(400, "titleKey is required");

  return listRepository.reorderListItem({
    userId,
    listId,
    titleKey: data.titleKey,
    beforeTitleKey: data.beforeTitleKey || null,
    afterTitleKey: data.afterTitleKey || null
  });
}
