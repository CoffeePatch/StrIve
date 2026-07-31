import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMotionPreferences } from '../../hooks/useMotionPreferences';
import { useLibraryFiltersContext } from '../../hooks/library/LibraryFiltersContext';
import { standardGenres } from '../../hooks/library/useLibraryFilters';
import { toDisplayWatchStatus } from '../../util/library/watchStatus';
import { AnimatedChip } from '../ui/AnimatedPrimitives';

const SORT_OPTIONS = [
  { id: 'title', label: 'Title' },
  { id: 'dateAdded', label: 'Date Added' },
  { id: 'lastWatched', label: 'Last Watched' },
  { id: 'imdb', label: 'IMDb Rating' },
  { id: 'tmdb', label: 'TMDB Rating' },
  { id: 'runtime', label: 'Runtime' }
];

const WATCH_STATUS_OPTIONS = [
  { id: 'plan_to_watch', label: 'Plan to Watch' },
  { id: 'watching', label: 'Watching' },
  { id: 'completed', label: 'Completed' },
  { id: 'on_hold', label: 'On Hold' },
  { id: 'dropped', label: 'Dropped' }
];

const RUNTIME_OPTIONS = [
  { id: '<60', label: '< 60 min' },
  { id: '60-90', label: '60 - 90 min' },
  { id: '90-120', label: '90 - 120 min' },
  { id: '120-180', label: '120 - 180 min' },
  { id: '180+', label: '180+ min' }
];

const DECADE_OPTIONS = [
  { label: '2020s', from: 2020, to: 2029 },
  { label: '2010s', from: 2010, to: 2019 },
  { label: '2000s', from: 2000, to: 2009 },
  { label: '1990s', from: 1990, to: 1999 },
  { label: '1980s', from: 1980, to: 1989 }
];

const RATING_OPTIONS = [
  { label: 'Any', value: null },
  { label: '9+', value: 9 },
  { label: '8+', value: 8 },
  { label: '7+', value: 7 },
  { label: '6+', value: 6 }
];

const AccordionSection = ({ title, children, isExpanded, onToggle }) => {
  return (
    <div className="border-b border-border-subtle">
      <button
        onClick={onToggle}
        className="w-full py-4 flex items-center justify-between text-left focus:outline-none"
        style={{ minHeight: '52px' }}
      >
        <span className="text-[15px] font-semibold text-primary font-secondary">{title}</span>
        <span className="material-symbols-outlined text-muted transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          expand_more
        </span>
      </button>
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="pb-5 pt-1 space-y-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const LibraryFilterSheet = ({ isOpen, onClose, items = [], customLists = [] }) => {
  const { spring } = useMotionPreferences();
  const filters = useLibraryFiltersContext();
  const [mounted, setMounted] = useState(false);

  // Accordion Expand States (Sort By is expanded by default, others collapsed)
  const [expandedSections, setExpandedSections] = useState({
    sort: true,
    status: false,
    mediaType: false,
    genre: false,
    year: false,
    rating: false,
    tmdbRating: false,
    imdbVotes: false,
    tmdbVotes: false,
    runtime: false,
    lists: false
  });

  // Local draft state for filters inside bottom sheet
  const [draftFilters, setDraftFilters] = useState({
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
    sortState: { key: 'dateAdded', direction: 'desc' }
  });

  // Sync draft state with global filter state whenever sheet is opened
  useEffect(() => {
    if (isOpen) {
      setDraftFilters({
        status: filters.status,
        type: filters.type,
        imdbRatingMin: filters.imdbRatingMin,
        imdbVotesMin: filters.imdbVotesMin,
        tmdbRatingMin: filters.tmdbRatingMin,
        tmdbVotesMin: filters.tmdbVotesMin,
        genres: [...filters.genres],
        yearFrom: filters.yearFrom,
        yearTo: filters.yearTo,
        customListIds: [...filters.customListIds],
        runtimes: [...filters.runtimes],
        sortState: { ...filters.sortState }
      });
    }
  }, [isOpen, filters]);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const updateDraft = (key, value) => {
    setDraftFilters(prev => ({
      ...prev,
      [key]: value
    }));
  };

  // Draft Toggle Handlers
  const handleSortOptionClick = (optionId) => {
    if (draftFilters.sortState?.key === optionId) {
      updateDraft('sortState', {
        key: optionId,
        direction: draftFilters.sortState.direction === 'asc' ? 'desc' : 'asc'
      });
    } else {
      updateDraft('sortState', {
        key: optionId,
        direction: optionId === 'title' ? 'asc' : 'desc'
      });
    }
  };

  const toggleStatus = (s) => {
    const active = draftFilters.status === 'all' ? [] : draftFilters.status.split(',').filter(Boolean);
    const next = active.includes(s) ? active.filter(x => x !== s) : [...active, s];
    updateDraft('status', next.length === 0 ? 'all' : next.join(','));
  };

  const toggleGenre = (g) => {
    const next = draftFilters.genres.includes(g)
      ? draftFilters.genres.filter(x => x !== g)
      : [...draftFilters.genres, g];
    updateDraft('genres', next);
  };

  const toggleRuntime = (r) => {
    const next = draftFilters.runtimes.includes(r)
      ? draftFilters.runtimes.filter(x => x !== r)
      : [...draftFilters.runtimes, r];
    updateDraft('runtimes', next);
  };

  const toggleList = (listId) => {
    const next = draftFilters.customListIds.includes(listId)
      ? draftFilters.customListIds.filter(id => id !== listId)
      : [...draftFilters.customListIds, listId];
    updateDraft('customListIds', next);
  };

  const toggleDecade = (decade) => {
    const isSelected = draftFilters.yearFrom === decade.from && draftFilters.yearTo === decade.to;
    if (isSelected) {
      updateDraft('yearFrom', null);
      updateDraft('yearTo', null);
    } else {
      updateDraft('yearFrom', decade.from);
      updateDraft('yearTo', decade.to);
    }
  };

  // Instant count calculation inside sheet using draft filter state (Memoized)
  const draftFilteredCount = useMemo(() => {
    return filters.getFilteredItemsInternal(items, draftFilters).length;
  }, [items, draftFilters, filters]);

  // Active filters in draft state (for the Current Filters top section)
  const activeDraftChips = useMemo(() => {
    const chips = [];

    // Statuses
    if (draftFilters.status !== 'all') {
      draftFilters.status.split(',').forEach(s => {
        chips.push({
          id: `status-${s}`,
          label: toDisplayWatchStatus(s),
          onClear: () => toggleStatus(s)
        });
      });
    }



    // Rating & Votes
    if (draftFilters.imdbRatingMin !== null) {
      chips.push({
        id: 'imdbRatingMin',
        label: `IMDb: ${draftFilters.imdbRatingMin}+`,
        onClear: () => updateDraft('imdbRatingMin', null)
      });
    }

    if (draftFilters.tmdbRatingMin !== null) {
      chips.push({
        id: 'tmdbRatingMin',
        label: `TMDB: ${draftFilters.tmdbRatingMin}+`,
        onClear: () => updateDraft('tmdbRatingMin', null)
      });
    }

    if (draftFilters.imdbVotesMin !== null) {
      const val = draftFilters.imdbVotesMin;
      const label = val >= 1000000 ? `${val/1000000}M+` : val >= 1000 ? `${val/1000}K+` : `${val}+`;
      chips.push({
        id: 'imdbVotesMin',
        label: `IMDb Votes: ${label}`,
        onClear: () => updateDraft('imdbVotesMin', null)
      });
    }

    if (draftFilters.tmdbVotesMin !== null) {
      const val = draftFilters.tmdbVotesMin;
      const label = val >= 1000000 ? `${val/1000000}M+` : val >= 1000 ? `${val/1000}K+` : `${val}+`;
      chips.push({
        id: 'tmdbVotesMin',
        label: `TMDB Votes: ${label}`,
        onClear: () => updateDraft('tmdbVotesMin', null)
      });
    }

    // Year range
    if (draftFilters.yearFrom !== null || draftFilters.yearTo !== null) {
      chips.push({
        id: 'yearRange',
        label: `Year: ${draftFilters.yearFrom || '...'} - ${draftFilters.yearTo || '...'}`,
        onClear: () => {
          updateDraft('yearFrom', null);
          updateDraft('yearTo', null);
        }
      });
    }

    // Genres
    draftFilters.genres.forEach(g => {
      chips.push({
        id: `genre-${g}`,
        label: g,
        onClear: () => toggleGenre(g)
      });
    });

    // Runtimes
    draftFilters.runtimes.forEach(r => {
      const option = RUNTIME_OPTIONS.find(opt => opt.id === r);
      chips.push({
        id: `runtime-${r}`,
        label: option ? option.label : r,
        onClear: () => toggleRuntime(r)
      });
    });

    // Custom Lists
    draftFilters.customListIds.forEach(id => {
      const listName = customLists.find(l => l.id === id)?.name || id;
      chips.push({
        id: `list-${id}`,
        label: `List: ${listName}`,
        onClear: () => toggleList(id)
      });
    });

    return chips;
  }, [draftFilters, customLists, toggleGenre, toggleList, toggleRuntime, toggleStatus]);

  const hasActiveFilters = activeDraftChips.length > 0;

  const handleApply = () => {
    // Sync all draft values back to global filters
    filters.updateFilters({
      status: draftFilters.status,
      type: draftFilters.type,
      imdbMin: draftFilters.imdbRatingMin,
      imdbVotesMin: draftFilters.imdbVotesMin,
      tmdbMin: draftFilters.tmdbRatingMin,
      tmdbVotesMin: draftFilters.tmdbVotesMin,
      genres: draftFilters.genres,
      yearFrom: draftFilters.yearFrom,
      yearTo: draftFilters.yearTo,
      lists: draftFilters.customListIds,
      runtimes: draftFilters.runtimes
    });
    filters.setSortState(draftFilters.sortState);
    onClose();
  };

  const handleReset = () => {
    setDraftFilters({
      status: 'all',
      type: filters.type,
      imdbRatingMin: null,
      imdbVotesMin: null,
      tmdbRatingMin: null,
      tmdbVotesMin: null,
      genres: [],
      yearFrom: null,
      yearTo: null,
      customListIds: [],
      runtimes: [],
      sortState: { key: 'dateAdded', direction: 'desc' }
    });
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center sm:p-4" style={{ pointerEvents: isOpen ? 'auto' : 'none' }}>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-backdrop backdrop-blur-sm"
          />

          {/* Bottom Sheet Panel */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={spring}
            className="w-full bg-surface rounded-t-3xl border border-border-subtle flex flex-col z-10"
            style={{ height: '90vh', maxHeight: '90vh' }}
          >
            {/* Gesture handle bar */}
            <div className="w-full flex justify-center pt-3 pb-1">
              <div className="w-12 h-1.2 bg-divider rounded-full" />
            </div>

            {/* Header */}
            <div className="px-5 py-3.5 flex justify-between items-center border-b border-border-subtle">
              <button
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-surface-hover text-secondary"
              >
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
              
              <h2 className="text-base font-bold text-primary tracking-wide">Filter & Sort</h2>

              <div className="w-9">
                {hasActiveFilters && (
                  <button
                    onClick={handleReset}
                    className="text-[13px] font-semibold text-accent hover:text-accent-hover whitespace-nowrap -ml-2"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto px-5 pb-36 scrollbar-thin">
              
              {/* Active Removable Chips Section */}
              {hasActiveFilters && (
                <div className="py-4 border-b border-border-subtle">
                  <h3 className="text-[12px] font-semibold text-muted uppercase tracking-wider mb-2 font-secondary">
                    Current Filters
                  </h3>
                  <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto pr-1">
                    {activeDraftChips.map(chip => (
                      <div
                        key={chip.id}
                        onClick={chip.onClear}
                        className="flex items-center gap-1 px-3 py-1 bg-accent/10 border border-accent/20 text-accent rounded-full text-[12px] font-medium cursor-pointer hover:bg-accent/20 transition-colors"
                      >
                        <span>{chip.label}</span>
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 1. Sort By Accordion */}
              <AccordionSection
                title="Sort By"
                isExpanded={expandedSections.sort}
                onToggle={() => toggleSection('sort')}
              >
                <div className="space-y-1">
                  {SORT_OPTIONS.map(opt => {
                    const isActive = draftFilters.sortState?.key === opt.id;

                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleSortOptionClick(opt.id)}
                        className="w-full h-13 flex items-center justify-between px-3 rounded-xl hover:bg-surface-hover transition-colors text-left"
                      >
                        <span className={`text-[14px] font-medium ${isActive ? 'text-accent' : 'text-primary'}`}>
                          {opt.label}
                        </span>
                        
                        {isActive ? (
                          <span className="material-symbols-outlined text-accent text-[20px]">
                            {draftFilters.sortState.direction === 'asc' ? 'arrow_upward' : 'arrow_downward'}
                          </span>
                        ) : (
                          <span className="material-symbols-outlined text-muted text-[20px]">
                            arrow_downward
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </AccordionSection>

              {/* 2. Watch Status Accordion */}
              <AccordionSection
                title="Watch Status"
                isExpanded={expandedSections.status}
                onToggle={() => toggleSection('status')}
              >
                <div className="flex flex-wrap gap-2">
                  {WATCH_STATUS_OPTIONS.map(opt => {
                    const active = draftFilters.status === 'all' ? [] : draftFilters.status.split(',').filter(Boolean);
                    const isSelected = active.includes(opt.id);

                    return (
                      <AnimatedChip
                        key={opt.id}
                        onClick={() => toggleStatus(opt.id)}
                        isActive={isSelected}
                      >
                        {opt.label}
                      </AnimatedChip>
                    );
                  })}
                </div>
              </AccordionSection>

              {/* 4. Genres Accordion */}
              <AccordionSection
                title="Genres"
                isExpanded={expandedSections.genre}
                onToggle={() => toggleSection('genre')}
              >
                <div className="flex flex-wrap gap-2 max-h-[220px] overflow-y-auto pr-1">
                  {standardGenres.map(g => {
                    const isSelected = draftFilters.genres.includes(g);
                    return (
                      <AnimatedChip
                        key={g}
                        onClick={() => toggleGenre(g)}
                        isActive={isSelected}
                      >
                        {g}
                      </AnimatedChip>
                    );
                  })}
                </div>
              </AccordionSection>

              {/* 5. Year Accordion */}
              <AccordionSection
                title="Year"
                isExpanded={expandedSections.year}
                onToggle={() => toggleSection('year')}
              >
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {DECADE_OPTIONS.map(decade => {
                      const isSelected = draftFilters.yearFrom === decade.from && draftFilters.yearTo === decade.to;
                      return (
                        <AnimatedChip
                          key={decade.label}
                          onClick={() => toggleDecade(decade)}
                          isActive={isSelected}
                        >
                          {decade.label}
                        </AnimatedChip>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex-1 flex flex-col gap-1.5">
                      <span className="text-[12px] text-secondary pl-1 font-secondary">Min Year</span>
                      <input
                        type="number"
                        placeholder="e.g. 1990"
                        value={draftFilters.yearFrom || ''}
                        onChange={(e) => updateDraft('yearFrom', e.target.value ? Number(e.target.value) : null)}
                        className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-2.5 text-[14px] text-primary focus:outline-none focus:border-accent/60 font-secondary"
                      />
                    </div>
                    <span className="text-muted mt-6">-</span>
                    <div className="flex-1 flex flex-col gap-1.5">
                      <span className="text-[12px] text-secondary pl-1 font-secondary">Max Year</span>
                      <input
                        type="number"
                        placeholder="e.g. 2025"
                        value={draftFilters.yearTo || ''}
                        onChange={(e) => updateDraft('yearTo', e.target.value ? Number(e.target.value) : null)}
                        className="w-full bg-surface border border-border-subtle rounded-xl px-4 py-2.5 text-[14px] text-primary focus:outline-none focus:border-accent/60 font-secondary"
                      />
                    </div>
                  </div>
                </div>
              </AccordionSection>

              {/* 6. IMDb Rating Accordion */}
              <AccordionSection
                title="IMDb Rating"
                isExpanded={expandedSections.rating}
                onToggle={() => toggleSection('rating')}
              >
                <div className="flex flex-wrap gap-2">
                  {RATING_OPTIONS.map(opt => {
                    const isSelected = draftFilters.imdbRatingMin === opt.value;
                    return (
                      <AnimatedChip
                        key={opt.label}
                        onClick={() => updateDraft('imdbRatingMin', opt.value)}
                        isActive={isSelected}
                      >
                        {opt.label}
                      </AnimatedChip>
                    );
                  })}
                </div>
              </AccordionSection>

              <AccordionSection
                title="TMDB Rating"
                isExpanded={expandedSections.tmdbRating}
                onToggle={() => toggleSection('tmdbRating')}
              >
                <div className="flex flex-wrap gap-2">
                  {RATING_OPTIONS.map(opt => {
                    const isSelected = draftFilters.tmdbRatingMin === opt.value;
                    return (
                      <AnimatedChip
                        key={opt.label}
                        onClick={() => updateDraft('tmdbRatingMin', opt.value)}
                        isActive={isSelected}
                      >
                        {opt.label}
                      </AnimatedChip>
                    );
                  })}
                </div>
              </AccordionSection>

              <AccordionSection
                title="IMDb Votes"
                isExpanded={expandedSections.imdbVotes}
                onToggle={() => toggleSection('imdbVotes')}
              >
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Any', value: null },
                    { label: '10K+', value: 10000 },
                    { label: '50K+', value: 50000 },
                    { label: '100K+', value: 100000 },
                    { label: '500K+', value: 500000 },
                  ].map(opt => {
                    const isSelected = draftFilters.imdbVotesMin === opt.value;
                    return (
                      <AnimatedChip
                        key={opt.label}
                        onClick={() => updateDraft('imdbVotesMin', opt.value)}
                        isActive={isSelected}
                      >
                        {opt.label}
                      </AnimatedChip>
                    );
                  })}
                </div>
              </AccordionSection>

              <AccordionSection
                title="TMDB Votes"
                isExpanded={expandedSections.tmdbVotes}
                onToggle={() => toggleSection('tmdbVotes')}
              >
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Any', value: null },
                    { label: '100+', value: 100 },
                    { label: '1K+', value: 1000 },
                    { label: '5K+', value: 5000 },
                    { label: '10K+', value: 10000 },
                    { label: '50K+', value: 50000 },
                  ].map(opt => {
                    const isSelected = draftFilters.tmdbVotesMin === opt.value;
                    return (
                      <AnimatedChip
                        key={opt.label}
                        onClick={() => updateDraft('tmdbVotesMin', opt.value)}
                        isActive={isSelected}
                      >
                        {opt.label}
                      </AnimatedChip>
                    );
                  })}
                </div>
              </AccordionSection>

              {/* 7. Runtime Accordion */}
              <AccordionSection
                title="Runtime"
                isExpanded={expandedSections.runtime}
                onToggle={() => toggleSection('runtime')}
              >
                <div className="flex flex-wrap gap-2">
                  {RUNTIME_OPTIONS.map(opt => {
                    const isSelected = draftFilters.runtimes.includes(opt.id);
                    return (
                      <AnimatedChip
                        key={opt.id}
                        onClick={() => toggleRuntime(opt.id)}
                        isActive={isSelected}
                      >
                        {opt.label}
                      </AnimatedChip>
                    );
                  })}
                </div>
              </AccordionSection>

              {/* 8. Custom Lists Accordion */}
              {customLists && customLists.length > 0 && (
                <AccordionSection
                  title="Lists"
                  isExpanded={expandedSections.lists}
                  onToggle={() => toggleSection('lists')}
                >
                  <div className="flex flex-wrap gap-2 max-h-[160px] overflow-y-auto pr-1">
                    {customLists.map(list => {
                      const isSelected = draftFilters.customListIds.includes(list.id);
                      return (
                        <AnimatedChip
                          key={list.id}
                          onClick={() => toggleList(list.id)}
                          isActive={isSelected}
                        >
                          {list.name}
                        </AnimatedChip>
                      );
                    })}
                  </div>
                </AccordionSection>
              )}
            </div>

            {/* Sticky Sticky Sticky Sticky Footer container */}
            <div className="absolute bottom-0 left-0 right-0 p-5 bg-surface/95 backdrop-blur-xl border-t border-border-subtle flex gap-4 items-center z-20 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
              <button
                onClick={handleReset}
                className="flex-1 h-12 flex items-center justify-center rounded-xl bg-surface border border-border-subtle text-secondary font-semibold text-[14px] hover:bg-surface-hover transition-colors"
              >
                Clear All
              </button>
              
              <button
                onClick={handleApply}
                className="flex-[2] h-12 flex items-center justify-center rounded-xl bg-accent text-inverse font-semibold text-[14px] hover:bg-accent-hover transition-colors shadow-lg shadow-accent/10"
              >
                Show {draftFilteredCount} Result{draftFilteredCount !== 1 ? 's' : ''}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};

export default LibraryFilterSheet;
