import * as libraryRepository from "../repositories/LibraryRepository.js";
import { ensureCatalogTitle } from "./catalogService.js";

export class ServiceError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = "ServiceError";
  }
}

export async function getLibrary(userId, options = {}) {
  if (!userId) throw new ServiceError(401, "Unauthenticated");
  return libraryRepository.getLibrary({ userId, ...options });
}

export async function updateLibraryStatus(userId, titleKey, status, options = {}) {
  if (!userId) throw new ServiceError(401, "Unauthenticated");
  if (!titleKey) throw new ServiceError(400, "TitleKey is required");

  // Ensure CatalogTitle exists in PostgreSQL before mutating user library item
  await ensureCatalogTitle(titleKey, options.metadata || {});

  // Validate status if provided
  const validStatuses = ["plan_to_watch", "watching", "completed", "dropped"];
  if (status && !validStatuses.includes(status)) {
    throw new ServiceError(400, "Invalid status");
  }

  // Validate userRating if provided
  let userRating = undefined;
  if ("userRating" in options) {
    if (options.userRating === null) {
      userRating = null;
    } else {
      const numRating = Number(options.userRating);
      if (!Number.isFinite(numRating) || numRating < 1.0 || numRating > 10.0 || Math.round(numRating * 2) !== numRating * 2) {
        throw new ServiceError(400, "Invalid user rating. Must be between 1.0 and 10.0 in 0.5 increments.");
      }
      userRating = numRating;
    }
  }

  // Validate notes if provided
  let notes = undefined;
  if ("notes" in options) {
    if (options.notes === null || options.notes === "") {
      notes = null;
    } else if (typeof options.notes !== "string") {
      throw new ServiceError(400, "Notes must be a string or null");
    } else if (options.notes.length > 5000) {
      throw new ServiceError(400, "Notes cannot exceed 5000 characters");
    } else {
      notes = options.notes;
    }
  }

  const updateStatus = status ? status : undefined;
  const lastWatchedAt = updateStatus === "completed" ? new Date() : undefined;

  return libraryRepository.updateLibraryStatus({
    userId,
    titleKey,
    status: updateStatus,
    lastWatchedAt,
    userRating,
    notes
  });
}

export async function deleteLibraryItem(userId, titleKey) {
  if (!userId) throw new ServiceError(401, "Unauthenticated");
  if (!titleKey) throw new ServiceError(400, "TitleKey is required");

  return libraryRepository.deleteLibraryItem({ userId, titleKey });
}

export async function batchProcessLibraryItems(userId, action, titleKeys, status) {
  if (!userId) throw new ServiceError(401, "Unauthenticated");
  if (!Array.isArray(titleKeys) || titleKeys.length === 0) {
    throw new ServiceError(400, "titleKeys array is required");
  }

  if (action === "delete") {
    return libraryRepository.batchDeleteLibraryItems({ userId, titleKeys });
  } else if (action === "update_status") {
    const validStatuses = ["plan_to_watch", "watching", "completed", "dropped"];
    if (status && !validStatuses.includes(status)) {
      throw new ServiceError(400, "Invalid status");
    }
    const updateStatus = status || "plan_to_watch";
    const lastWatchedAt = updateStatus === "completed" ? new Date() : undefined;

    return libraryRepository.batchUpdateLibraryStatus({
      userId,
      titleKeys,
      status: updateStatus,
      lastWatchedAt
    });
  } else {
    throw new ServiceError(400, "Invalid batch action");
  }
}

export async function getContinueWatching(userId, options = {}) {
  if (!userId) throw new ServiceError(401, "Unauthenticated");

  const limit = Number(options.limit) || 20;
  return libraryRepository.getContinueWatching({ userId, limit });
}
