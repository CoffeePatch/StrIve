import { getAllLibraryItems } from '../../services/libraryService';
import { getOrFetchLibraryData } from './libraryPipelineCache';

const applyMockSizeDuplication = (items, mockSizeStr) => {
  if (!mockSizeStr) return items;

  const targetSize = parseInt(mockSizeStr, 10);
  if (!targetSize || targetSize <= 0) return items;

  let duplicated = [];
  while (duplicated.length < targetSize) {
    duplicated = duplicated.concat(items.map((item, idx) => ({
      ...item,
      id: `${item.id}_mock_${duplicated.length}_${idx}`,
      titleKey: `${item.titleKey}_mock_${duplicated.length}_${idx}`,
    })));
  }

  return duplicated.slice(0, targetSize);
};

export const loadLibraryItems = async (userId, options = {}) => {
  if (!userId) return [];

  const {
    hydrate = false,
    includePageInfo = false,
    mockSize = null,
  } = options;

  const cacheKey = `all_items:${userId}:${hydrate ? 'hydrated' : 'raw'}`;
  const fetchedItems = await getOrFetchLibraryData({
    key: cacheKey,
    ttlMs: 2 * 60 * 1000,
    fetcher: async () => getAllLibraryItems(userId, { hydrate, includePageInfo }),
  });
  const normalizedItems = Array.isArray(fetchedItems) ? fetchedItems : [];
  return applyMockSizeDuplication(normalizedItems, mockSize);
};

export const loadLibraryListItems = async (userId, listIds = [], options = {}) => {
  if (!userId) return {};

  const normalizedListIds = Array.isArray(listIds)
    ? [...new Set(listIds.filter(Boolean))]
    : [];

  if (normalizedListIds.length === 0) return {};

  const {
    hydrate = false,
    includePageInfo = false,
  } = options;

  const allItems = await loadLibraryItems(userId, { hydrate, includePageInfo });

  const results = normalizedListIds.map((listId) => {
    const listItems = (Array.isArray(allItems) ? allItems : []).filter((item) => {
      const listIdsForItem = Array.isArray(item?.tracking?.listIds) ? item.tracking.listIds : [];
      return listIdsForItem.includes(listId);
    });
    return [listId, listItems];
  });

  return Object.fromEntries(results);
};