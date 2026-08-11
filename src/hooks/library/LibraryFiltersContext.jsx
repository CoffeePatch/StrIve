import React, { createContext, useContext } from 'react';

export const LibraryFiltersContext = createContext(null);

const defaultFiltersContext = {
  searchQuery: '',
  setSearchQuery: () => {},
  filtersOpen: false,
  setFiltersOpen: () => {},
  status: 'all',
  type: 'all',
  imdbRatingMin: null,
  imdbVotesMin: null,
  tmdbRatingMin: null,
  tmdbVotesMin: null,
  genres: [],
  yearFrom: null,
  yearTo: null,
  customListIds: [],
  runtimes: [],
  sortState: { key: 'tmdb', direction: 'desc' },
  setSortState: () => {},
  updateFilters: () => {},
  clearAdvancedFilters: () => {},
  filteredItems: [],
  activeSecondaryFilterCount: 0,
  getFilteredItemsInternal: () => [],
  getImdbRating: () => null,
  getImdbVotes: () => null,
  getTmdbRating: () => null,
  getTmdbVotes: () => null,
};

export const useLibraryFiltersContext = () => {
  const context = useContext(LibraryFiltersContext);
  return context || defaultFiltersContext;
};
