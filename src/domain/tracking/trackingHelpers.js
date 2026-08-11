/**
 * Normalizes season and episode data into a flat catalog with absolute ordering
 * and aired status.
 *
 * @param {Array|null} allSeasonsData - Complete catalog if available
 * @param {Array} currentSeasonEpisodes - Fallback catalog for single season view
 * @returns {Array} - Normalized catalog
 */
export const buildEpisodeCatalog = (allSeasonsData, currentSeasonEpisodes = []) => {
  if (allSeasonsData && allSeasonsData.length > 0) {
    return allSeasonsData
      .flatMap((season) =>
        season.episodes?.map((ep) => ({
          ...ep,
          seasonNumber: season.season_number,
        })) || []
      )
      .map((ep, idx) => ({
        seasonNumber: Number(ep.seasonNumber ?? ep.season_number),
        episodeNumber: Number(ep.episodeNumber ?? ep.episode_number),
        absoluteOrder:
          Number(ep.absoluteOrder) ||
          (Number(ep.seasonNumber ?? ep.season_number) * 1000 +
            Number(ep.episodeNumber ?? ep.episode_number)) ||
          idx + 1,
        isAired: ep.air_date ? new Date(ep.air_date) <= new Date() : true,
      }))
      .filter(
        (ep) =>
          Number.isInteger(ep.seasonNumber) && Number.isInteger(ep.episodeNumber)
      );
  }

  // Fallback to current season episodes
  return currentSeasonEpisodes
    .map((ep, idx) => ({
      seasonNumber: Number(ep.seasonNumber ?? ep.season_number),
      episodeNumber: Number(ep.episodeNumber ?? ep.episode_number),
      absoluteOrder:
        Number(ep.absoluteOrder) ||
        (Number(ep.seasonNumber ?? ep.season_number) * 1000 +
          Number(ep.episodeNumber ?? ep.episode_number)) ||
        idx + 1,
      isAired: ep.isAired !== false,
    }))
    .filter(
      (ep) => Number.isInteger(ep.seasonNumber) && Number.isInteger(ep.episodeNumber)
    );
};

/**
 * Selects which episodes should be updated based on the mode.
 *
 * @param {Array} catalog - Normalized episode catalog
 * @param {string} mode - 'single' or 'backfill_to_episode'
 * @param {number} sn - Target Season Number
 * @param {number} en - Target Episode Number
 * @returns {Array} - Selected episodes to update
 */
export const selectEpisodesForMode = (catalog, mode, sn, en) => {
  if (mode === "all") {
    return catalog
      .filter((ep) => ep.isAired)
      .sort((a, b) => a.absoluteOrder - b.absoluteOrder);
  }

  const target = catalog.find(
    (ep) => ep.seasonNumber === sn && ep.episodeNumber === en
  );

  if (!target) {
    throw new Error(`Episode S${sn}E${en} not found in catalog.`);
  }

  if (mode === "season") {
    return catalog
      .filter((ep) => ep.seasonNumber === sn && ep.isAired)
      .sort((a, b) => a.absoluteOrder - b.absoluteOrder);
  }

  if (mode === "single") {
    if (!target.isAired) {
      throw new Error("Target episode has not aired yet.");
    }
    return [target];
  }

  if (mode === "backfill_to_episode") {
    return catalog
      .filter((ep) => ep.isAired && ep.absoluteOrder <= target.absoluteOrder)
      .sort((a, b) => a.absoluteOrder - b.absoluteOrder);
  }

  return [target];
};

/**
 * Creates a unique string key for an episode
 * 
 * @param {number} seasonNumber
 * @param {number} episodeNumber
 * @returns {string} e.g. "1:4"
 */
export const createEpisodeKey = (seasonNumber, episodeNumber) => {
  return `${Number(seasonNumber)}:${Number(episodeNumber)}`;
};
