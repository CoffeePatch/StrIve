const WATCH_STATUS_DISPLAY = {
  plan_to_watch: "Plan to Watch",
  watching: "Watching",
  completed: "Completed",
  dropped: "Dropped",
};

export const normalizeWatchStatus = (value) => {
  if (value === null || value === undefined) return null;
  const raw = String(value).trim();
  if (!raw) return null;

  const normalized = raw
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/[^a-z_]/g, "");

  if (normalized === "plan_to_watch") return "plan_to_watch";
  if (normalized === "watching") return "watching";
  if (normalized === "completed") return "completed";
  if (normalized === "dropped") return "dropped";

  return null;
};

export const toDisplayWatchStatus = (value) => {
  const normalized = normalizeWatchStatus(value);
  if (!normalized) return value ?? null;
  return WATCH_STATUS_DISPLAY[normalized] || value || null;
};

export const isWatchStatus = (value, expected) => {
  const left = normalizeWatchStatus(value);
  const right = normalizeWatchStatus(expected);
  if (!left || !right) return false;
  return left === right;
};
