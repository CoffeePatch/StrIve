import { useState, useCallback, useMemo } from 'react';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getItemYear = (item) => {
  if (item.releaseDate) {
    const dateStr = typeof item.releaseDate === 'string' ? item.releaseDate : String(item.releaseDate);
    const yearMatch = dateStr.match(/\d{4}/);
    if (yearMatch) return yearMatch[0];
  }
  return null;
};

const getTmdbRating = (item) => toNumber(item?.ratings?.tmdbScore ?? item.vote_average);
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

const matchesScoreBucket = (score, bucket) => {
  if (bucket === 'all') return true;
  if (score == null) return false;
  if (bucket === '9plus') return score >= 9;
  if (bucket === '8plus') return score >= 8;
  if (bucket === '7plus') return score >= 7;
  if (bucket === '6plus') return score >= 6;
  if (bucket === 'below6') return score < 6;
  return true;
};

const matchesVotesBucket = (votes, bucket) => {
  if (bucket === 'all') return true;
  if (votes == null) return false;
  if (bucket === '1000plus') return votes >= 1000;
  if (bucket === '10000plus') return votes >= 10000;
  if (bucket === '50000plus') return votes >= 50000;
  if (bucket === '100000plus') return votes >= 100000;
  if (bucket === '150000plus') return votes >= 150000;
  if (bucket === '500000plus') return votes >= 500000;
  if (bucket === '1000000plus') return votes >= 1000000;
  return true;
};

export function useLibraryFilters(items) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [imdbFilter, setImdbFilter] = useState('all');
  const [imdbVotesFilter, setImdbVotesFilter] = useState('all');
  const [tmdbFilter, setTmdbFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [genreFilter, setGenreFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');

  const availableYears = useMemo(() => {
    const yearSet = new Set();
    items.forEach((item) => {
      const year = getItemYear(item);
      if (year) yearSet.add(year);
    });
    return Array.from(yearSet).sort((a, b) => b - a);
  }, [items]);

  const clearAdvancedFilters = useCallback(() => {
    setImdbFilter('all');
    setImdbVotesFilter('all');
    setTmdbFilter('all');
    setTypeFilter('all');
    setGenreFilter('all');
    setYearFilter('all');
  }, []);

  const filteredItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return items.filter((item) => {
      const title = (item.title || item.name || '').toLowerCase();
      if (query && !title.includes(query)) return false;

      const imdb = getImdbRating(item);
      if (!matchesScoreBucket(imdb, imdbFilter)) return false;

      const imdbVotes = getImdbVotes(item);
      if (!matchesVotesBucket(imdbVotes, imdbVotesFilter)) return false;

      const tmdb = getTmdbRating(item);
      if (!matchesScoreBucket(tmdb, tmdbFilter)) return false;

      // Map filter values to Firestore media_type values
      if (typeFilter !== 'all') {
        const itemMediaType = (item.media_type || item.mediaType || '').toLowerCase();
        const firestoreType = typeFilter === 'series' ? 'tv' : typeFilter;
        if (itemMediaType !== firestoreType) return false;
      }

      const itemYear = getItemYear(item);
      if (yearFilter !== 'all' && itemYear < parseInt(yearFilter)) return false;

      if (genreFilter !== 'all') {
        const genres = getItemGenres(item).map((g) => g.toLowerCase());
        if (!genres.includes(genreFilter.toLowerCase())) return false;
      }

      return true;
    });
  }, [items, searchQuery, imdbFilter, imdbVotesFilter, tmdbFilter, typeFilter, yearFilter, genreFilter]);

  return {
    searchQuery, setSearchQuery,
    filtersOpen, setFiltersOpen,
    imdbFilter, setImdbFilter,
    imdbVotesFilter, setImdbVotesFilter,
    tmdbFilter, setTmdbFilter,
    typeFilter, setTypeFilter,
    genreFilter, setGenreFilter,
    yearFilter, setYearFilter,
    availableYears,
    clearAdvancedFilters,
    filteredItems,
    getImdbRating,
    getImdbVotes
  };
}
