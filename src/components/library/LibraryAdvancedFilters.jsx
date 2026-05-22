import React from 'react';
import { standardGenres } from '../../hooks/library/useLibraryFilters';

const LibraryAdvancedFilters = ({ filters, inline }) => {
  const {
    imdbFilter, setImdbFilter,
    imdbVotesFilter, setImdbVotesFilter,
    tmdbFilter, setTmdbFilter,
    typeFilter, setTypeFilter,
    genreFilter, setGenreFilter,
    yearFilter, setYearFilter,
    availableYears,
    clearAdvancedFilters
  } = filters;

  const containerClass = inline
    ? "overflow-x-auto flex-1 min-w-0"
    : "glass-effect rounded-xl px-3 py-2 border border-white/10 bg-white/5 overflow-x-auto";

  return (
    <div className={containerClass}>
      <div className="flex items-center gap-2 min-w-max">
        <span className="material-symbols-outlined text-white/60 text-base">tune</span>

        <select
          value={imdbFilter}
          onChange={(e) => setImdbFilter(e.target.value)}
          className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-500/60"
          title="IMDb Rating"
        >
          <option value="all">IMDb: All</option>
          <option value="9plus">IMDb: 9+</option>
          <option value="8plus">IMDb: 8+</option>
          <option value="7plus">IMDb: 7+</option>
          <option value="6plus">IMDb: 6+</option>
          <option value="below6">IMDb: Below 6</option>
        </select>

        <select
          value={imdbVotesFilter}
          onChange={(e) => setImdbVotesFilter(e.target.value)}
          className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-500/60"
          title="IMDb Votes"
        >
          <option value="all">Votes: All</option>
          <option value="1000plus">1K+ votes</option>
          <option value="10000plus">10K+ votes</option>
          <option value="50000plus">50K+ votes</option>
          <option value="100000plus">100K+ votes</option>
          <option value="150000plus">150K+ votes</option>
          <option value="500000plus">500K+ votes</option>
          <option value="1000000plus">1M+ votes</option>
        </select>

        <select
          value={tmdbFilter}
          onChange={(e) => setTmdbFilter(e.target.value)}
          className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-500/60"
          title="TMDB Rating"
        >
          <option value="all">TMDB: All</option>
          <option value="9plus">TMDB: 9+</option>
          <option value="8plus">TMDB: 8+</option>
          <option value="7plus">TMDB: 7+</option>
          <option value="6plus">TMDB: 6+</option>
          <option value="below6">TMDB: Below 6</option>
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-500/60"
          title="Type"
        >
          <option value="all">Type: All</option>
          <option value="movie">Movie</option>
          <option value="series">Series</option>
        </select>

        <select
          value={genreFilter}
          onChange={(e) => setGenreFilter(e.target.value)}
          className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-500/60"
          title="Genres"
        >
          <option value="all">Genres: All</option>
          {standardGenres.map((genre) => (
            <option key={genre} value={genre}>
              {genre}
            </option>
          ))}
        </select>

        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="bg-black/30 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-red-500/60"
          title="Years"
        >
          <option value="all">Years: All</option>
          {availableYears.map((year) => (
            <option key={year} value={String(year)}>
              {year}
            </option>
          ))}
        </select>

        <button
          onClick={clearAdvancedFilters}
          className="px-2.5 py-1.5 rounded-lg border border-white/15 text-white/70 hover:text-white hover:border-white/30 text-xs transition-colors"
          title="Clear filters"
        >
          <span className="material-symbols-outlined text-sm">restart_alt</span>
        </button>
      </div>
    </div>
  );
};

export default LibraryAdvancedFilters;
