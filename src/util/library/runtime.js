/**
 * Shared utility to resolve the runtime of a media item in minutes.
 * 
 * @param {Object} item - Media library item
 * @returns {number|null} Runtime in minutes, or null if not available
 */
export const getRuntime = (item) => {
  if (!item) return null;
  const runtime = item?.metadata?.runtimeMinutes ?? item?.runtime ?? item?.runtimeMinutes;
  const num = Number(runtime);
  return num && num > 0 && !isNaN(num) ? num : null;
};
