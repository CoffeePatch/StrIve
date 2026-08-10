/**
 * Utilities for chunking Strive Backup JSON payloads into 100-item sequential batches
 */

export function createImportBatches(fullBackupPayload, batchSize = 100) {
  if (!fullBackupPayload || typeof fullBackupPayload !== "object") {
    return [];
  }

  const library = Array.isArray(fullBackupPayload.library) ? fullBackupPayload.library : [];
  const episodeStates = Array.isArray(fullBackupPayload.episodeStates) ? fullBackupPayload.episodeStates : [];
  const lists = Array.isArray(fullBackupPayload.lists) ? fullBackupPayload.lists : [];
  const catalog = Array.isArray(fullBackupPayload.catalog) ? fullBackupPayload.catalog : [];
  const seasons = Array.isArray(fullBackupPayload.seasons) ? fullBackupPayload.seasons : [];
  const episodes = Array.isArray(fullBackupPayload.episodes) ? fullBackupPayload.episodes : [];

  if (library.length === 0) {
    return [
      {
        batchIndex: 0,
        totalBatches: 1,
        user: fullBackupPayload.user || {},
        library: [],
        episodeStates,
        lists,
        catalog,
        seasons,
        episodes,
      },
    ];
  }

  const catalogMap = new Map(catalog.map(c => [c.titleKey, c]));
  const seasonMap = new Map(seasons.map(s => [`${s.titleKey}_s${s.seasonNumber}`, s]));
  const episodeMap = new Map(episodes.map(e => [`${e.titleKey}_s${e.seasonNumber}_e${e.episodeNumber}`, e]));

  const batches = [];
  const totalBatches = Math.ceil(library.length / batchSize);

  for (let i = 0; i < library.length; i += batchSize) {
    const batchIndex = Math.floor(i / batchSize);
    const libraryChunk = library.slice(i, i + batchSize);
    const titleKeysChunk = new Set(libraryChunk.map(item => item.titleKey));

    const episodeStatesChunk = episodeStates.filter(ep => titleKeysChunk.has(ep.titleKey));

    const catalogChunkMap = new Map();
    const seasonsChunkMap = new Map();
    const episodesChunkMap = new Map();

    titleKeysChunk.forEach(titleKey => {
      if (catalogMap.has(titleKey)) {
        catalogChunkMap.set(titleKey, catalogMap.get(titleKey));
      }
    });

    episodeStatesChunk.forEach(ep => {
      const sKey = `${ep.titleKey}_s${ep.seasonNumber}`;
      if (seasonMap.has(sKey)) seasonsChunkMap.set(sKey, seasonMap.get(sKey));

      const eKey = `${ep.titleKey}_s${ep.seasonNumber}_e${ep.episodeNumber}`;
      if (episodeMap.has(eKey)) episodesChunkMap.set(eKey, episodeMap.get(eKey));
    });

    // Custom lists included in first batch
    const listsChunk = batchIndex === 0 ? lists : [];

    batches.push({
      batchIndex,
      totalBatches,
      user: batchIndex === 0 ? (fullBackupPayload.user || {}) : {},
      library: libraryChunk,
      episodeStates: episodeStatesChunk,
      lists: listsChunk,
      catalog: Array.from(catalogChunkMap.values()),
      seasons: Array.from(seasonsChunkMap.values()),
      episodes: Array.from(episodesChunkMap.values()),
    });
  }

  return batches;
}
