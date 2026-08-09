import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DURATIONS, EASINGS } from '../../util/motion';
import { AnimatedButton } from '../ui/AnimatedPrimitives';
import LibraryAdvancedFilters from './LibraryAdvancedFilters';

const LibraryFilterBar = ({
  status = 'all',
  type = 'all',
  filtersOpen = false,
  setFiltersOpen,
  updateFilters,
  clearAdvancedFilters,
  activeSecondaryFilterCount = 0,
  customListIds = [],
  customLists = [],
  imdbRatingMin,
  imdbVotesMin,
  tmdbRatingMin,
  tmdbVotesMin,
  genres = [],
  yearFrom,
  yearTo,
  libraryFilters,
}) => {
  return (
    <div className="px-8 max-w-[1440px] mx-auto w-full mb-6">
      <div className="flex items-center justify-between border-b border-border-subtle pb-4">
        <div className="flex items-center">
          {/* Status Pills */}
          <div className="flex items-center gap-2">
            {['all', 'watchlist', 'watching', 'completed'].map((s) => (
              <AnimatedButton
                key={s}
                onClick={() => updateFilters?.({ status: s })}
                className={`h-[36px] px-4 rounded-full text-[14px] font-secondary transition-colors border ${
                  status === s
                    ? 'bg-accent text-inverse border-accent font-semibold'
                    : 'bg-surface text-secondary border-border-subtle hover:border-border hover:text-primary hover:bg-surface-hover'
                }`}
              >
                {s === 'all'
                  ? 'All'
                  : s === 'watchlist'
                  ? 'Plan to Watch'
                  : s.charAt(0).toUpperCase() + s.slice(1)}
              </AnimatedButton>
            ))}
          </div>

          <div className="w-[1px] h-[24px] bg-divider mx-4" />

          {/* Type Pills */}
          <div className="flex items-center gap-2">
            <AnimatedButton
              onClick={() => updateFilters?.({ type: 'all' })}
              className={`h-[36px] px-4 rounded-full text-[14px] font-secondary transition-colors border flex items-center gap-2 ${
                type === 'all'
                  ? 'bg-accent text-inverse border-accent font-semibold'
                  : 'bg-surface text-secondary border-border-subtle hover:border-border hover:text-primary hover:bg-surface-hover'
              }`}
            >
              All Types
            </AnimatedButton>
            <AnimatedButton
              onClick={() => updateFilters?.({ type: 'movie' })}
              className={`h-[36px] px-4 rounded-full text-[14px] font-secondary transition-colors border flex items-center gap-2 ${
                type === 'movie'
                  ? 'bg-accent text-inverse border-accent font-semibold'
                  : 'bg-surface text-secondary border-border-subtle hover:border-border hover:text-primary hover:bg-surface-hover'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">movie</span> Movies
            </AnimatedButton>
            <AnimatedButton
              onClick={() => updateFilters?.({ type: 'tv' })}
              className={`h-[36px] px-4 rounded-full text-[14px] font-secondary transition-colors border flex items-center gap-2 ${
                type === 'tv'
                  ? 'bg-accent text-inverse border-accent font-semibold'
                  : 'bg-surface text-secondary border-border-subtle hover:border-border hover:text-primary hover:bg-surface-hover'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">tv</span> Shows
            </AnimatedButton>
          </div>
        </div>

        {/* Filter Drawer Button */}
        <div className="flex items-center">
          <AnimatedButton
            onClick={() => setFiltersOpen?.(!filtersOpen)}
            className={`h-[36px] px-[14px] rounded-full border text-[14px] flex items-center gap-[6px] transition-colors font-secondary ${
              activeSecondaryFilterCount > 0
                ? 'bg-accent/20 border-accent text-primary'
                : 'bg-surface border-border-subtle text-secondary hover:text-primary hover:border-border hover:bg-surface-hover'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            Filters
            {activeSecondaryFilterCount > 0 && (
              <span className="w-[6px] h-[6px] rounded-full bg-accent ml-1" />
            )}
          </AnimatedButton>
        </div>
      </div>

      {/* Advanced Filter Drawer */}
      <AnimatePresence initial={false}>
        {filtersOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: DURATIONS.fast, ease: EASINGS.standard }}
            className="overflow-hidden"
          >
            <div className="pt-4">
              <LibraryAdvancedFilters filters={libraryFilters} customLists={customLists} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Filter Chips / Tags */}
      {activeSecondaryFilterCount > 0 && (
        <div className="flex items-center gap-2 pt-4 flex-wrap">
          <AnimatePresence mode="popLayout">
            {customListIds.map((id) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                key={id}
                className="px-3 py-1.5 rounded-full bg-surface-hover text-[12px] text-secondary font-secondary border border-border-subtle flex items-center gap-1.5"
              >
                List: {customLists?.find((l) => l.id === id)?.name || id}
                <button
                  onClick={() => updateFilters?.({ lists: customListIds.filter((x) => x !== id) })}
                  className="hover:text-primary"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </motion.div>
            ))}

            {imdbRatingMin && (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                key="imdbRatingMin"
                className="px-3 py-1.5 rounded-full bg-surface-hover text-[12px] text-secondary font-secondary border border-border-subtle flex items-center gap-1.5"
              >
                IMDb: {imdbRatingMin}+
                <button onClick={() => updateFilters?.({ imdbMin: null })} className="hover:text-primary">
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </motion.div>
            )}

            {imdbVotesMin && (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                key="imdbVotesMin"
                className="px-3 py-1.5 rounded-full bg-surface-hover text-[12px] text-secondary font-secondary border border-border-subtle flex items-center gap-1.5"
              >
                IMDb Votes:{' '}
                {imdbVotesMin >= 1000000
                  ? `${imdbVotesMin / 1000000}M`
                  : imdbVotesMin >= 1000
                  ? `${imdbVotesMin / 1000}K`
                  : imdbVotesMin}
                +
                <button onClick={() => updateFilters?.({ imdbVotesMin: null })} className="hover:text-primary">
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </motion.div>
            )}

            {tmdbRatingMin && (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                key="tmdbRatingMin"
                className="px-3 py-1.5 rounded-full bg-surface-hover text-[12px] text-secondary font-secondary border border-border-subtle flex items-center gap-1.5"
              >
                TMDB: {tmdbRatingMin}+
                <button onClick={() => updateFilters?.({ tmdbMin: null })} className="hover:text-primary">
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </motion.div>
            )}

            {tmdbVotesMin && (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                key="tmdbVotesMin"
                className="px-3 py-1.5 rounded-full bg-surface-hover text-[12px] text-secondary font-secondary border border-border-subtle flex items-center gap-1.5"
              >
                TMDB Votes:{' '}
                {tmdbVotesMin >= 1000000
                  ? `${tmdbVotesMin / 1000000}M`
                  : tmdbVotesMin >= 1000
                  ? `${tmdbVotesMin / 1000}K`
                  : tmdbVotesMin}
                +
                <button onClick={() => updateFilters?.({ tmdbVotesMin: null })} className="hover:text-primary">
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </motion.div>
            )}

            {libraryFilters?.userRatingMin && (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                key="userRatingMin"
                className="px-3 py-1.5 rounded-full bg-surface-hover text-[12px] text-secondary font-secondary border border-border-subtle flex items-center gap-1.5"
              >
                My Rating: ★ {libraryFilters.userRatingMin}+
                <button onClick={() => updateFilters?.({ userRatingMin: null })} className="hover:text-primary">
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </motion.div>
            )}

            {libraryFilters?.hasNotesOnly && (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                key="hasNotesOnly"
                className="px-3 py-1.5 rounded-full bg-surface-hover text-[12px] text-secondary font-secondary border border-border-subtle flex items-center gap-1.5"
              >
                Has Personal Notes
                <button onClick={() => updateFilters?.({ hasNotesOnly: false })} className="hover:text-primary">
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </motion.div>
            )}

            {(libraryFilters?.runtimes || []).map((r) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                key={`r-${r}`}
                className="px-3 py-1.5 rounded-full bg-surface-hover text-[12px] text-secondary font-secondary border border-border-subtle flex items-center gap-1.5"
              >
                Runtime: {r}m
                <button
                  onClick={() => updateFilters?.({ runtimes: libraryFilters.runtimes.filter((x) => x !== r) })}
                  className="hover:text-primary"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </motion.div>
            ))}

            {genres.map((g) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                key={`g-${g}`}
                className="px-3 py-1.5 rounded-full bg-surface-hover text-[12px] text-secondary font-secondary border border-border-subtle flex items-center gap-1.5"
              >
                {g}
                <button
                  onClick={() => updateFilters?.({ genres: genres.filter((x) => x !== g) })}
                  className="hover:text-primary"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </motion.div>
            ))}

            {(yearFrom || yearTo) && (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                key="year"
                className="px-3 py-1.5 rounded-full bg-surface-hover text-[12px] text-secondary font-secondary border border-border-subtle flex items-center gap-1.5"
              >
                Year: {yearFrom || '...'} - {yearTo || '...'}
                <button
                  onClick={() => updateFilters?.({ yearFrom: null, yearTo: null })}
                  className="hover:text-primary"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatedButton
            onClick={clearAdvancedFilters}
            className="text-[12px] text-muted font-secondary hover:text-primary bg-transparent ml-2"
          >
            Clear all
          </AnimatedButton>
        </div>
      )}
    </div>
  );
};

export default React.memo(LibraryFilterBar);
