import { useState, useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { normalizeWatchStatus } from '../../util/library/watchStatus';
import { getRuntime } from '../../util/library/runtime';

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

const getDateMs = (val) => {
  if (!val) return 0;
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (typeof val === 'number') return val;
  if (typeof val === 'object') {
    const sec = val.seconds ?? val._seconds;
    if (typeof sec === 'number') {
      const nsec = val.nanoseconds ?? val._nanoseconds ?? 0;
      return sec * 1000 + Math.floor(nsec / 1000000);
    }
  }
  const time = new Date(val).getTime();
  return isNaN(time) ? 0 : time;
};

const getTmdbRating = (item) => toNumber(item?.ratings?.tmdbScore ?? item?.vote_average);
const getTmdbVotes = (item) => toNumber(item?.ratings?.tmdbVotes ?? item?.vote_count);
const getImdbRating = (item) => toNumber(item?.ratings?.imdbScore ?? item?.imdbRating ?? item?.imdb_rating);
const getImdbVotes = (item) => toNumber(item?.ratings?.imdbVotes ?? item?.imdbVotes ?? item?.imdb_vote_count);
const getUserRating = (item) => toNumber(item?.userRating ?? item?.tracking?.userRating);
const hasNotes = (item) => Boolean((item?.notes && String(item.notes).trim()) || (item?.tracking?.userNotes && String(item.tracking.userNotes).trim()));

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
  
  // Search state: searchQuery for immediate input typing, debouncedSearchQuery for list filtering
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');

  // Search parameter sync for searchQuery
  const searchParamQuery = searchParams.get('search') || '';

  // Local React States for advanced filters to prevent URL bloat
  const [status, setStatus] = useState(() => searchParams.get('status') || 'all');
  const [type, setType] = useState(() => searchParams.get('type') || 'all');

  // Sync status, type, and sort from URL when searchParams changes
  useEffect(() => {
    const urlStatus = searchParams.get('status');
    if (urlStatus !== null) {
      setStatus(urlStatus || 'all');
    }
    const urlType = searchParams.get('type');
    setType(urlType || 'all');
    const urlList = searchParams.get('list');
    if (urlList) {
      setCustomListIds([urlList]);
    }
    const urlSort = searchParams.get('sort');
    if (urlSort !== null) {
      const parts = urlSort.split(':');
      if (parts.length === 2) {
        _setSortState({ key: parts[0], direction: parts[1] });
      }
    } else {
      try {
        const saved = localStorage.getItem('librarySortPreference');
        _setSortState(saved ? JSON.parse(saved) : null);
      } catch {
        _setSortState(null);
      }
    }
  }, [searchParams]);
  const [imdbRatingMin, setImdbRatingMin] = useState(null);
  const [imdbVotesMin, setImdbVotesMin] = useState(null);
  const [tmdbRatingMin, setTmdbRatingMin] = useState(null);
  const [tmdbVotesMin, setTmdbVotesMin] = useState(null);
  const [userRatingMin, setUserRatingMin] = useState(null);
  const [hasNotesOnly, setHasNotesOnly] = useState(false);
  const [genres, setGenres] = useState([]);
  const [yearFrom, setYearFrom] = useState(null);
  const [yearTo, setYearTo] = useState(null);
  const [customListIds, setCustomListIds] = useState([]);
  const [runtimes, setRuntimes] = useState([]);

  // Sort State - Read from URL query param, fallback to localStorage
  const [sortState, _setSortState] = useState(() => {
    const urlSort = searchParams.get('sort');
    if (urlSort) {
      const parts = urlSort.split(':');
      if (parts.length === 2) {
        return { key: parts[0], direction: parts[1] };
      }
    }
    try {
      const saved = localStorage.getItem('librarySortPreference');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error reading librarySortPreference from localStorage', e);
    }
    return null;
  });

  const activeSortState = useMemo(() => {
    if (sortState) return sortState;
    // Apply dynamic defaults per status tab
    const firstStatus = status.split(',')[0] || 'all';
    const defaults = {
      watching: { key: 'lastWatched', direction: 'desc' },
      completed: { key: 'imdb', direction: 'desc' },
      plan_to_watch: { key: 'dateAdded', direction: 'desc' },
      dropped: { key: 'dateAdded', direction: 'desc' },
    };
    return defaults[firstStatus] ?? { key: 'dateAdded', direction: 'desc' };
  }, [sortState, status]);

  const setSortState = useCallback((newState) => {
    try {
      localStorage.setItem('librarySortPreference', JSON.stringify(newState));
    } catch (e) {
      console.error('Error saving librarySortPreference to localStorage', e);
    }
    _setSortState(newState);
    setSearchParams(prev => {
      if (newState) {
        prev.set('sort', `${newState.key}:${newState.direction}`);
      } else {
        prev.delete('sort');
      }
      return prev;
    }, { replace: true });
  }, [setSearchParams]);

  // Sync internal search query state when URL changes
  useEffect(() => {
    setSearchQuery(searchParamQuery);
    setDebouncedSearchQuery(searchParamQuery);
  }, [searchParamQuery]);

  // Debounce search query updates internally (250ms)
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 250);

    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Sync debounced search query state to URL parameters
  useEffect(() => {
    if (debouncedSearchQuery === searchParamQuery) return;

    setSearchParams(prev => {
      if (debouncedSearchQuery.trim() === '') {
        prev.delete('search');
      } else {
        prev.set('search', debouncedSearchQuery);
      }
      return prev;
    }, { replace: true });
  }, [debouncedSearchQuery, searchParamQuery, setSearchParams]);

  const updateFilters = useCallback((updates) => {
    Object.keys(updates).forEach(key => {
      const val = updates[key];
      if (key === 'status') setStatus(val ?? 'all');
      else if (key === 'type') {
        setType(val ?? 'all');
        try { sessionStorage.setItem('libraryTypePreference', val ?? 'all'); } catch { /* ignore storage error */ }
      }
      else if (key === 'imdbMin') setImdbRatingMin(val);
      else if (key === 'imdbVotesMin') setImdbVotesMin(val);
      else if (key === 'tmdbMin') setTmdbRatingMin(val);
      else if (key === 'tmdbVotesMin') setTmdbVotesMin(val);
      else if (key === 'userRatingMin') setUserRatingMin(val);
      else if (key === 'hasNotesOnly') setHasNotesOnly(Boolean(val));
      else if (key === 'genres') setGenres(val ?? []);
      else if (key === 'yearFrom') setYearFrom(val);
      else if (key === 'yearTo') setYearTo(val);
      else if (key === 'lists') setCustomListIds(val ?? []);
      else if (key === 'runtimes') setRuntimes(val ?? []);
      else if (key === 'search') setSearchQuery(val ?? '');
    });
  }, []);

  const clearAdvancedFilters = useCallback(() => {
    setStatus('all');
    setType('all');
    try { sessionStorage.setItem('libraryTypePreference', 'all'); } catch { /* ignore storage error */ }
    setImdbRatingMin(null);
    setImdbVotesMin(null);
    setTmdbRatingMin(null);
    setTmdbVotesMin(null);
    setUserRatingMin(null);
    setHasNotesOnly(false);
    setGenres([]);
    setYearFrom(null);
    setYearTo(null);
    setCustomListIds([]);
    setRuntimes([]);
  }, []);

  // Filtering engine logic (uses debouncedSearchQuery)
  const getFilteredItemsInternal = useCallback((itemsList, filterState) => {
    const query = debouncedSearchQuery.trim().toLowerCase();
    
    // Custom list items intersection (OR logic for list IDs)
    let itemsToFilter = itemsList;
    if (filterState.customListIds.length > 0) {
      const allowedIds = new Set();
      let hasData = false;
      filterState.customListIds.forEach(listId => {
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
        itemsToFilter = itemsList.filter(item => {
          const mediaType = item.media_type || item.mediaType;
          const titleKey = item.titleKey || '';
          const keyMatch = String(titleKey).match(/^tmdb_(movie|tv)_(\d+)$/);
          const id = keyMatch ? keyMatch[2] : item.id;
          return allowedIds.has(`${mediaType}_${id}`);
        });
      } else {
        itemsToFilter = []; 
      }
    }

    const filtered = itemsToFilter.filter((item) => {
      // Free-text search
      const title = (item.title || item.name || '').toLowerCase();
      if (query && !title.includes(query)) return false;

      // Watch Status
      const itemStatus = normalizeWatchStatus(
        item?.tracking?.watchStatus ?? item?.watchStatus ?? item?.status
      );

      if (filterState.status !== 'all') {
        const selectedStatuses = filterState.status.split(',').map(normalizeWatchStatus).filter(Boolean);
        if (selectedStatuses.length > 0 && !selectedStatuses.includes(itemStatus)) {
          return false;
        }
      } else if (filterState.customListIds.length === 0) {
        if (!itemStatus) return false;
      }

      // Media Type (Movies, TV Shows, Anime)
      if (filterState.type !== 'all') {
        const selectedTypes = filterState.type.split(',').map(t => t.toLowerCase());
        if (selectedTypes.length > 0) {
          const itemMediaType = (item.media_type || item.mediaType || '').toLowerCase();
          
          const isAnime = item.mediaType === 'anime' ||
                          item.media_type === 'anime' ||
                          item.origin_country === 'JP' ||
                          item.originCountry === 'JP' ||
                          (Array.isArray(item.origin_country) && item.origin_country.includes('JP')) ||
                          (Array.isArray(item.originCountry) && item.originCountry.includes('JP'));

          const matches = selectedTypes.some(t => {
            if (t === 'anime') return isAnime;
            if (t === 'movie') return itemMediaType === 'movie' && !isAnime;
            if (t === 'tv' || t === 'series') return itemMediaType === 'tv';
            return false;
          });

          if (!matches) return false;
        }
      }

      // IMDb Rating
      if (filterState.imdbRatingMin !== null) {
        const imdb = getImdbRating(item);
        if (imdb == null || imdb < filterState.imdbRatingMin) return false;
      }

      // IMDb Votes
      if (filterState.imdbVotesMin !== null) {
        const votes = getImdbVotes(item);
        if (votes == null || votes < filterState.imdbVotesMin) return false;
      }

      // TMDB Rating
      if (filterState.tmdbRatingMin !== null) {
        const tmdb = getTmdbRating(item);
        if (tmdb == null || tmdb < filterState.tmdbRatingMin) return false;
      }

      // TMDB Votes
      if (filterState.tmdbVotesMin !== null) {
        const tmdbVotes = getTmdbVotes(item);
        if (tmdbVotes == null || tmdbVotes < filterState.tmdbVotesMin) return false;
      }

      // User Rating (My Rating)
      if (filterState.userRatingMin !== null) {
        const uRating = getUserRating(item);
        if (uRating == null || uRating < filterState.userRatingMin) return false;
      }

      // Personal Notes
      if (filterState.hasNotesOnly) {
        if (!hasNotes(item)) return false;
      }

      // Year Range
      const itemYear = getItemYear(item);
      if (filterState.yearFrom !== null) {
        if (itemYear == null || itemYear < filterState.yearFrom) return false;
      }
      if (filterState.yearTo !== null) {
        if (itemYear == null || itemYear > filterState.yearTo) return false;
      }

      // Genres
      if (filterState.genres.length > 0) {
        const itemGenres = getItemGenres(item).map((g) => g.toLowerCase());
        const hasGenre = filterState.genres.some(g => itemGenres.includes(g.toLowerCase()));
        if (!hasGenre) return false;
      }

      // Runtimes Range
      if (filterState.runtimes.length > 0) {
        const runtime = getRuntime(item);
        if (runtime == null) return false;

        const matchesRange = filterState.runtimes.some(range => {
          if (range === '<60') return runtime < 60;
          if (range === '60-90') return runtime >= 60 && runtime <= 90;
          if (range === '90-120') return runtime >= 90 && runtime <= 120;
          if (range === '120-180') return runtime >= 120 && runtime <= 180;
          if (range === '180+') return runtime > 180;
          return false;
        });

        if (!matchesRange) return false;
      }

      return true;
    });

    const comparators = {
      imdb: (a, b) => {
        const aScore = getImdbRating(a) ?? -1;
        const bScore = getImdbRating(b) ?? -1;
        return bScore - aScore;
      },
      tmdb: (a, b) => {
        const aScore = getTmdbRating(a) ?? -1;
        const bScore = getTmdbRating(b) ?? -1;
        return bScore - aScore;
      },
      dateAdded: (a, b) => {
        const aMs = getDateMs(a.tracking?.addedAt) || getDateMs(a.addedAt) || getDateMs(a.tracking?.updatedAt);
        const bMs = getDateMs(b.tracking?.addedAt) || getDateMs(b.addedAt) || getDateMs(b.tracking?.updatedAt);
        return bMs - aMs;
      },
      dateUpdated: (a, b) => {
        const aMs = getDateMs(a.tracking?.lastUserInteractionAt) || getDateMs(a.tracking?.updatedAt) || getDateMs(a.tracking?.addedAt);
        const bMs = getDateMs(b.tracking?.lastUserInteractionAt) || getDateMs(b.tracking?.updatedAt) || getDateMs(b.tracking?.addedAt);
        return bMs - aMs;
      },
      lastWatched: (a, b) => {
        const aMs = getDateMs(a.tracking?.lastWatchedAt);
        const bMs = getDateMs(b.tracking?.lastWatchedAt);
        if (bMs !== aMs) return bMs - aMs;
        return (getDateMs(b.tracking?.addedAt) || getDateMs(b.addedAt)) - (getDateMs(a.tracking?.addedAt) || getDateMs(a.addedAt));
      },
      releaseYear: (a, b) => {
        const aYear = getItemYear(a) ?? 0;
        const bYear = getItemYear(b) ?? 0;
        return bYear - aYear;
      },
      runtime: (a, b) => {
        const aRuntime = getRuntime(a) ?? 0;
        const bRuntime = getRuntime(b) ?? 0;
        return bRuntime - aRuntime;
      },
      title: (a, b) =>
        (a.title ?? a.name ?? '').localeCompare(b.title ?? b.name ?? '', undefined, {
          sensitivity: 'base'
        })
    };

    return [...filtered].sort((a, b) => {
      const result = comparators[activeSortState.key](a, b);
      return activeSortState.direction === 'asc' ? -result : result;
    });
  }, [activeSortState, debouncedSearchQuery, customListsItemsMap]);

  // Derived filtered items based on current active states
  const filteredItems = useMemo(() => {
    return getFilteredItemsInternal(items, {
      status,
      type,
      imdbRatingMin,
      imdbVotesMin,
      tmdbRatingMin,
      tmdbVotesMin,
      userRatingMin,
      hasNotesOnly,
      genres,
      yearFrom,
      yearTo,
      customListIds,
      runtimes
    });
  }, [items, getFilteredItemsInternal, status, type, imdbRatingMin, imdbVotesMin, tmdbRatingMin, tmdbVotesMin, userRatingMin, hasNotesOnly, genres, yearFrom, yearTo, customListIds, runtimes]);

  // Active filters count for badge (excluding default 'all' or empty states)
  const activeSecondaryFilterCount = useMemo(() => {
    let count = 0;
    if (status !== 'all' && status !== '') count++;
    if (type !== 'all' && type !== '') count++;
    if (imdbRatingMin !== null) count++;
    if (imdbVotesMin !== null) count++;
    if (tmdbRatingMin !== null) count++;
    if (tmdbVotesMin !== null) count++;
    if (userRatingMin !== null) count++;
    if (hasNotesOnly) count++;
    if (genres.length > 0) count++;
    if (yearFrom !== null || yearTo !== null) count++;
    if (customListIds.length > 0) count++;
    if (runtimes.length > 0) count++;
    return count;
  }, [status, type, imdbRatingMin, imdbVotesMin, tmdbRatingMin, tmdbVotesMin, userRatingMin, hasNotesOnly, genres, yearFrom, yearTo, customListIds, runtimes]);

  // Wrap values in a stable useMemo object context container
  const contextValue = useMemo(() => ({
    searchQuery, setSearchQuery,
    filtersOpen, setFiltersOpen,
    status,
    type,
    imdbRatingMin,
    imdbVotesMin,
    tmdbRatingMin,
    tmdbVotesMin,
    userRatingMin,
    hasNotesOnly,
    genres,
    yearFrom,
    yearTo,
    customListIds,
    runtimes,
    sortState: activeSortState,
    setSortState,
    updateFilters,
    clearAdvancedFilters,
    filteredItems,
    activeSecondaryFilterCount,
    getFilteredItemsInternal,
    getImdbRating,
    getImdbVotes,
    getTmdbRating,
    getTmdbVotes,
    getUserRating,
    hasNotes
  }), [
    searchQuery, filtersOpen, status, type, imdbRatingMin, imdbVotesMin, tmdbRatingMin, tmdbVotesMin,
    userRatingMin, hasNotesOnly, genres, yearFrom, yearTo, customListIds, runtimes, activeSortState, setSortState,
    updateFilters, clearAdvancedFilters, filteredItems, activeSecondaryFilterCount,
    getFilteredItemsInternal
  ]);

  return contextValue;
}
