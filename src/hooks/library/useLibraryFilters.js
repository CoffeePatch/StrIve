import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { normalizeWatchStatus } from '../../util/library/watchStatus';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getItemYear = (item) => {
  if (item.release_date || item.first_air_date) {
    const dateStr = String(item.release_date || item.first_air_date);
    const yearMatch = dateStr.match(/\d{4}/);
    if (yearMatch) return parseInt(yearMatch[0], 10);
  }
  if (item.releaseDate) {
    const dateStr = typeof item.releaseDate === 'string' ? item.releaseDate : String(item.releaseDate);
    const yearMatch = dateStr.match(/\d{4}/);
    if (yearMatch) return parseInt(yearMatch[0], 10);
  }
  return null;
};

const getTmdbRating = (item) => toNumber(item?.vote_average ?? item?.ratings?.tmdbScore);
const getTmdbVotes = (item) => toNumber(item?.vote_count ?? item?.ratings?.tmdbVotes);
const getImdbRating = (item) => toNumber(item?.ratings?.imdbScore ?? item.imdbRating);
const getImdbVotes = (item) => toNumber(item?.ratings?.imdbVotes ?? item.imdbVotes);

const getItemGenres = (item) => {
  if (!Array.isArray(item.genres)) return [];
  return item.genres
    .map((genre) => {
      if (typeof genre === 'string') return genre;
      if (genre && typeof genre === 'object' && typeof genre.name === 'string') {
        return genre.name;
      }
      return null;
    })
    .filter(Boolean);
};

export const standardGenres = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
  'Drama', 'Family', 'Fantasy', 'History', 'Horror', 'Music',
  'Mystery', 'Romance', 'Science Fiction', 'Thriller', 'War', 'Western',
];

export function useLibraryFilters(items, customListsItemsMap = {}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // URL synced state
  const status = searchParams.get('status') || 'watchlist';
  const type = searchParams.get('type') || 'all';
  const imdbRatingMin = searchParams.get('imdbMin') ? Number(searchParams.get('imdbMin')) : null;
  const imdbVotesMin = searchParams.get('imdbVotesMin') ? Number(searchParams.get('imdbVotesMin')) : null;
  const tmdbRatingMin = searchParams.get('tmdbMin') ? Number(searchParams.get('tmdbMin')) : null;
  const tmdbVotesMin = searchParams.get('tmdbVotesMin') ? Number(searchParams.get('tmdbVotesMin')) : null;
  const genres = searchParams.get('genres') ? searchParams.get('genres').split(',') : [];
  const yearFrom = searchParams.get('yearFrom') ? Number(searchParams.get('yearFrom')) : null;
  const yearTo = searchParams.get('yearTo') ? Number(searchParams.get('yearTo')) : null;
  const customListIds = searchParams.get('lists') ? searchParams.get('lists').split(',') : [];
  const searchParamQuery = searchParams.get('search') || '';
  const sort = searchParams.get('sort') || 'rating-desc';

  // Sync internal search query state when URL changes, only initially or externally driven
  useEffect(() => {
    setSearchQuery(searchParamQuery);
  }, [searchParamQuery]);

  const updateFilters = useCallback((updates) => {
    setSearchParams(prev => {
      Object.keys(updates).forEach(key => {
        const val = updates[key];
        if (val === null || val === undefined || val === 'all' || (Array.isArray(val) && val.length === 0) || val === '') {
          prev.delete(key);
        } else {
          prev.set(key, Array.isArray(val) ? val.join(',') : String(val));
        }
      });
      return prev;
    }, { replace: true });
  }, [setSearchParams]);

  const clearAdvancedFilters = useCallback(() => {
    updateFilters({
      imdbMin: null,
      imdbVotesMin: null,
      tmdbMin: null,
      tmdbVotesMin: null,
      genres: null,
      yearFrom: null,
      yearTo: null,
      lists: null,
    });
  }, [updateFilters]);

  // Derived filtered items
  const filteredItems = useMemo(() => {
    const query = searchParamQuery.trim().toLowerCase();

    // Intersection with selected lists
    let itemsToFilter = items;
    if (customListIds.length > 0) {
      // Create a set of IDs that are present in any of the selected lists (OR logic)
      const allowedIds = new Set();
      let hasData = false;
      customListIds.forEach(listId => {
        if (customListsItemsMap[listId]) {
          hasData = true;
          customListsItemsMap[listId].forEach(item => {
            const mediaType = item.media_type || item.mediaType;
            const titleKey = item.titleKey || '';
            const keyMatch = String(titleKey).match(/^tmdb_(movie|tv)_(\d+)$/);
            const id = keyMatch ? keyMatch[2] : item.id;
            allowedIds.add(`${mediaType}_${id}`);
          });
        }
      });

      if (hasData) {
         itemsToFilter = items.filter(item => {
            const mediaType = item.media_type || item.mediaType;
            const titleKey = item.titleKey || '';
            const keyMatch = String(titleKey).match(/^tmdb_(movie|tv)_(\d+)$/);
            const id = keyMatch ? keyMatch[2] : item.id;
            return allowedIds.has(`${mediaType}_${id}`);
         });
      } else {
         // Data is probably still fetching.
         itemsToFilter = []; 
      }
    }

    return itemsToFilter.filter((item) => {
      // Free-text search
      const title = (item.title || item.name || '').toLowerCase();
      if (query && !title.includes(query)) return false;

      // Status
      if (status !== 'all') {
        const itemStatus = normalizeWatchStatus(
          item?.tracking?.watchStatus ?? item?.watchStatus ?? item?.status
        );
        const targetStatus = normalizeWatchStatus(status);
        if (targetStatus && itemStatus !== targetStatus) return false;
      }

      // Type
      if (type !== 'all') {
        const itemMediaType = (item.media_type || item.mediaType || '').toLowerCase();
        const firestoreType = type === 'series' ? 'tv' : type;
        if (itemMediaType !== firestoreType) return false;
      }

      // IMDb Rating
      if (imdbRatingMin !== null) {
        const imdb = getImdbRating(item);
        if (imdb == null || imdb < imdbRatingMin) return false;
      }

      // IMDb Votes
      if (imdbVotesMin !== null) {
        const votes = getImdbVotes(item);
        if (votes == null || votes < imdbVotesMin) return false;
      }

      // TMDB Rating
      if (tmdbRatingMin !== null) {
        const tmdb = getTmdbRating(item);
        if (tmdb == null || tmdb < tmdbRatingMin) return false;
      }

      // TMDB Votes
      if (tmdbVotesMin !== null) {
        const tmdbVotes = getTmdbVotes(item);
        if (tmdbVotes == null || tmdbVotes < tmdbVotesMin) return false;
      }

      // Year Range
      const itemYear = getItemYear(item);
      if (yearFrom !== null) {
        if (itemYear == null || itemYear < yearFrom) return false;
      }
      if (yearTo !== null) {
        if (itemYear == null || itemYear > yearTo) return false;
      }

      // Genres
      if (genres.length > 0) {
        const itemGenres = getItemGenres(item).map((g) => g.toLowerCase());
        const hasGenre = genres.some(g => itemGenres.includes(g.toLowerCase()));
        if (!hasGenre) return false;
      }

      return true;
    });
  }, [items, customListIds, customListsItemsMap, searchParamQuery, type, imdbRatingMin, imdbVotesMin, tmdbRatingMin, tmdbVotesMin, yearFrom, yearTo, genres]);

  const activeSecondaryFilterCount = useMemo(() => {
    let count = 0;
    if (imdbRatingMin !== null) count++;
    if (imdbVotesMin !== null) count++;
    if (tmdbRatingMin !== null) count++;
    if (tmdbVotesMin !== null) count++;
    if (genres.length > 0) count++;
    if (yearFrom !== null || yearTo !== null) count++;
    if (customListIds.length > 0) count++;
    return count;
  }, [imdbRatingMin, imdbVotesMin, tmdbRatingMin, tmdbVotesMin, genres, yearFrom, yearTo, customListIds]);

  return {
    searchQuery, setSearchQuery,
    filtersOpen, setFiltersOpen,
    status,
    type,
    imdbRatingMin,
    imdbVotesMin,
    tmdbRatingMin,
    tmdbVotesMin,
    genres,
    yearFrom,
    yearTo,
    customListIds,
    sort,
    updateFilters,
    clearAdvancedFilters,
    filteredItems,
    activeSecondaryFilterCount,
    getImdbRating,
    getImdbVotes,
    getTmdbRating,
    getTmdbVotes
  };
}
