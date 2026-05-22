const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed =
    typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
};

export const firstNumber = (...values) => {
  for (const value of values) {
    const numeric = toNumber(value);
    if (numeric !== null) return numeric;
  }
  return null;
};

export { fetchImdbData } from '../../services/imdbService';

export {
  upsertLibraryItem,
  getLibraryItemListIds,
  setLibraryItemListIds,
  setLibraryItemStatus,
  updateLibraryItem,
  toggleCustomListTag,
  getLibraryItem,
  getLibraryByStatus,
  getLibraryByListId
} from '../../services/libraryService';

export {
  createCustomList,
  deleteCustomList,
  updateCustomList,
  removeListIdFromAllLibraryItems,
  addItemToCustomList,
  addItemsToCustomListBatch,
  removeItemFromCustomList,
  fetchUserLists,
  fetchUserListsWithPreviews,
  fetchListWithItems,
  pinList,
  unpinList,
  createDefaultWatchLaterList,
  updateItemEnrichment,
  getPendingItemsInList
} from '../../services/customListsService';

export {
  refreshLibraryMetadata,
  refreshCustomListMetadata,
  getItemsWithMissingMetadata,
  getMetadataStatistics
} from '../../services/metadataService';
