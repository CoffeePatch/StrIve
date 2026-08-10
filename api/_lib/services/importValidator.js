/**
 * Dedicated validator for Strive Backup JSON payloads
 */

export class BackupValidationError extends Error {
  constructor(statusCode, code, message, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = "BackupValidationError";
    this.details = details;
  }
}

export const SUPPORTED_SCHEMA_VERSION = 1;
const VALID_STATUSES = new Set(["plan_to_watch", "watching", "completed", "dropped", "paused"]);

/**
 * Normalizes status string to Strive canonical key
 */
export function normalizeStatus(statusStr) {
  if (!statusStr) return "plan_to_watch";
  const s = String(statusStr).trim().toLowerCase().replace(/[\s_-]+/g, "");
  if (s.includes("completed") || s.includes("watched") || s.includes("finished")) return "completed";
  if (s.includes("watching") || s.includes("current") || s.includes("inprogress")) return "watching";
  if (s.includes("dropped") || s.includes("abandoned")) return "dropped";
  if (s.includes("paused") || s.includes("onhold")) return "paused";
  return "plan_to_watch";
}

/**
 * Validates root structure, format, schemaVersion, and entity integrity of a Strive Backup JSON
 */
export function validateBackupPayload(rawPayload) {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
    throw new BackupValidationError(400, "invalid-json-root", "Backup payload must be a JSON object");
  }

  const format = rawPayload.format || "strive-backup";
  if (format !== "strive-backup") {
    throw new BackupValidationError(400, "invalid-backup-format", `Invalid backup format '${format}'. Expected 'strive-backup'.`);
  }

  const schemaVersion = Number(rawPayload.schemaVersion);
  if (!Number.isFinite(schemaVersion) || schemaVersion < 1) {
    throw new BackupValidationError(400, "invalid-schema-version", "Backup schemaVersion must be a positive integer.");
  }

  if (schemaVersion > SUPPORTED_SCHEMA_VERSION) {
    throw new BackupValidationError(
      422,
      "unsupported-schema-version",
      `Unsupported backup schemaVersion ${schemaVersion}. Current max supported version is ${SUPPORTED_SCHEMA_VERSION}.`
    );
  }

  const errors = [];
  const warnings = [];

  // Validate Library Items
  const library = Array.isArray(rawPayload.library) ? rawPayload.library : [];
  library.forEach((item, idx) => {
    if (!item || typeof item !== "object") {
      errors.push(`library[${idx}]: Item must be an object`);
      return;
    }

    if (!item.titleKey && (!item.tmdbId || !item.mediaType)) {
      errors.push(`library[${idx}]: Missing required titleKey or tmdbId/mediaType identity key`);
    }

    if (item.status && !VALID_STATUSES.has(normalizeStatus(item.status))) {
      warnings.push(`library[${idx}]: Unknown status '${item.status}', defaulting to 'plan_to_watch'`);
    }

    if (item.userRating !== null && item.userRating !== undefined) {
      const rating = Number(item.userRating);
      if (!Number.isFinite(rating) || rating < 0.5 || rating > 10.0) {
        warnings.push(`library[${idx}]: User rating ${item.userRating} is outside 0.5 - 10.0 range`);
      }
    }
  });

  // Validate Episode States
  const episodeStates = Array.isArray(rawPayload.episodeStates) ? rawPayload.episodeStates : [];
  episodeStates.forEach((ep, idx) => {
    if (!ep || typeof ep !== "object") {
      errors.push(`episodeStates[${idx}]: Episode state must be an object`);
      return;
    }
    if (!ep.titleKey) {
      errors.push(`episodeStates[${idx}]: Missing required titleKey`);
    }
    if (typeof ep.seasonNumber !== "number" || ep.seasonNumber < 0) {
      errors.push(`episodeStates[${idx}]: Invalid seasonNumber '${ep.seasonNumber}'`);
    }
    if (typeof ep.episodeNumber !== "number" || ep.episodeNumber < 1) {
      errors.push(`episodeStates[${idx}]: Invalid episodeNumber '${ep.episodeNumber}'`);
    }
  });

  // Validate Lists
  const lists = Array.isArray(rawPayload.lists) ? rawPayload.lists : [];
  lists.forEach((list, idx) => {
    if (!list || typeof list !== "object") {
      errors.push(`lists[${idx}]: List entry must be an object`);
      return;
    }
    if (!list.name || !String(list.name).trim()) {
      errors.push(`lists[${idx}]: Missing required list name`);
    }
    if (list.items && !Array.isArray(list.items)) {
      errors.push(`lists[${idx}]: List items must be an array`);
    }
  });

  if (errors.length > 0) {
    throw new BackupValidationError(
      400,
      "invalid-backup-structure",
      `Backup structural validation failed with ${errors.length} error(s)`,
      { errors, warnings }
    );
  }

  return {
    valid: true,
    schemaVersion,
    warnings,
  };
}
