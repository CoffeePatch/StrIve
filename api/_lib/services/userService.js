import * as userRepository from "../repositories/UserRepository.js";
import { ServiceError } from "./libraryService.js";

const ALLOWED_PREF_KEYS = [
  "continueWatching",
  "recentlyAdded",
  "recentlyWatched",
  "watchlistPicks"
];

export async function getUserPreferences(userId) {
  if (!userId) throw new ServiceError(401, "Unauthenticated");
  return userRepository.getUserPreferences({ userId });
}

export async function updateUserPreferences(userId, partialPrefs) {
  if (!userId) throw new ServiceError(401, "Unauthenticated");

  // Validate allowed keys
  const validUpdates = {};
  for (const [key, value] of Object.entries(partialPrefs)) {
    if (ALLOWED_PREF_KEYS.includes(key) && typeof value === "boolean") {
      validUpdates[key] = value;
    }
  }

  if (Object.keys(validUpdates).length === 0) {
    throw new ServiceError(400, "No valid preference keys provided");
  }

  // Get current
  const current = await userRepository.getUserPreferences({ userId });
  
  // Merge
  const nextPrefs = {
    ...(current && typeof current === 'object' ? current : {}),
    ...validUpdates
  };

  return userRepository.updateUserPreferences({ userId, preferences: nextPrefs });
}

export async function getUserWatchHistory(userId, options = {}) {
  if (!userId) throw new ServiceError(401, "Unauthenticated");
  const limit = Math.min(100, Math.max(1, Number(options.limit) || 50));
  const offset = Math.max(0, Number(options.offset) || 0);

  return userRepository.getUserWatchHistory({ userId, limit, offset });
}

export async function getUserAnalytics(userId) {
  if (!userId) throw new ServiceError(401, "Unauthenticated");
  return userRepository.getUserAnalytics({ userId });
}
