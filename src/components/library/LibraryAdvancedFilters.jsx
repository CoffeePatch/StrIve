import React from 'react';
import { standardGenres } from '../../hooks/library/useLibraryFilters';
import { AnimatedChip, AnimatedCheckbox } from '../ui/AnimatedPrimitives';

const LibraryAdvancedFilters = ({ filters = {}, customLists = [] }) => {
  const {
    imdbRatingMin = null,
    imdbVotesMin = null,
    tmdbRatingMin = null,
    tmdbVotesMin = null,
    genres = [],
    yearFrom = null,
    yearTo = null,
    customListIds = [],
    updateFilters = () => {}
  } = filters || {};

  const toggleList = (id) => {
    if (customListIds.includes(id)) {
      updateFilters({ lists: customListIds.filter(l => l !== id) });
    } else {
      updateFilters({ lists: [...customListIds, id] });
    }
  };

  const toggleGenre = (g) => {
    if (genres.includes(g)) {
      updateFilters({ genres: genres.filter(x => x !== g) });
    } else {
      updateFilters({ genres: [...genres, g] });
    }
  };

  return (
    <div className="glass-effect rounded-xl p-6 border border-border-subtle bg-surface space-y-6">
       
       {/* Custom Lists */}
       {customLists && customLists.length > 0 && (
         <div className="space-y-3">
           <h3 className="text-[13px] font-semibold text-secondary uppercase tracking-wider font-secondary">Custom Lists</h3>
           <div className="flex flex-wrap gap-2">
             {customLists.map(list => {
               const isActive = customListIds.includes(list.id);
               return (
                 <AnimatedChip
                   key={list.id}
                   onClick={() => toggleList(list.id)}
                   isActive={isActive}
                 >
                   {list.name}
                 </AnimatedChip>
               );
             })}
           </div>
         </div>
       )}

       {/* Ratings */}
       <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-3">
            <h3 className="text-[13px] font-semibold text-secondary uppercase tracking-wider font-secondary">IMDb Rating</h3>
            <div className="flex flex-wrap gap-2">
               {[
                 { label: 'Any', value: null },
                 { label: '9+', value: 9 },
                 { label: '8+', value: 8 },
                 { label: '7+', value: 7 },
                 { label: '6+', value: 6 },
               ].map(opt => (
                 <AnimatedChip
                   key={opt.label}
                   onClick={() => updateFilters({ imdbMin: opt.value })}
                   isActive={imdbRatingMin === opt.value}
                 >
                   {opt.label}
                 </AnimatedChip>
               ))}
            </div>
          </div>
          
          <div className="flex-1 space-y-3">
            <h3 className="text-[13px] font-semibold text-secondary uppercase tracking-wider font-secondary">TMDB Rating</h3>
            <div className="flex flex-wrap gap-2">
               {[
                 { label: 'Any', value: null },
                 { label: '9+', value: 9 },
                 { label: '8+', value: 8 },
                 { label: '7+', value: 7 },
                 { label: '6+', value: 6 },
               ].map(opt => (
                 <AnimatedChip
                   key={opt.label}
                   onClick={() => updateFilters({ tmdbMin: opt.value })}
                   isActive={tmdbRatingMin === opt.value}
                 >
                   {opt.label}
                 </AnimatedChip>
               ))}
            </div>
          </div>
       </div>

       {/* Votes */}
       <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-3">
            <h3 className="text-[13px] font-semibold text-secondary uppercase tracking-wider font-secondary">IMDb Votes</h3>
            <div className="flex flex-wrap gap-2">
               {[
                 { label: 'Any', value: null },
                 { label: '10K+', value: 10000 },
                 { label: '50K+', value: 50000 },
                 { label: '100K+', value: 100000 },
                 { label: '500K+', value: 500000 },
               ].map(opt => (
                 <AnimatedChip
                   key={opt.label}
                   onClick={() => updateFilters({ imdbVotesMin: opt.value })}
                   isActive={imdbVotesMin === opt.value}
                 >
                   {opt.label}
                 </AnimatedChip>
               ))}
            </div>
          </div>

          <div className="flex-1 space-y-3">
            <h3 className="text-[13px] font-semibold text-secondary uppercase tracking-wider font-secondary">TMDB Votes</h3>
            <div className="flex flex-wrap gap-2">
               {[
                 { label: 'Any', value: null },
                 { label: '100+', value: 100 },
                 { label: '1K+', value: 1000 },
                 { label: '5K+', value: 5000 },
                 { label: '10K+', value: 10000 },
                 { label: '50K+', value: 50000 },
               ].map(opt => (
                 <AnimatedChip
                   key={opt.label}
                   onClick={() => updateFilters({ tmdbVotesMin: opt.value })}
                   isActive={tmdbVotesMin === opt.value}
                 >
                   {opt.label}
                 </AnimatedChip>
               ))}
            </div>
          </div>
       </div>

       {/* Year & Genres */}
       <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 space-y-3">
            <h3 className="text-[13px] font-semibold text-secondary uppercase tracking-wider font-secondary">Release Year</h3>
            <div className="flex items-center gap-3">
              <input 
                type="number" 
                placeholder="From" 
                value={yearFrom || ''} 
                onChange={(e) => updateFilters({ yearFrom: e.target.value ? Number(e.target.value) : null })}
                className="w-24 bg-backdrop border border-border-subtle rounded-lg px-3 py-1.5 text-[13px] text-primary focus:outline-none focus:border-accent/60 font-secondary"
              />
              <span className="text-muted">-</span>
              <input 
                type="number" 
                placeholder="To" 
                value={yearTo || ''} 
                onChange={(e) => updateFilters({ yearTo: e.target.value ? Number(e.target.value) : null })}
                className="w-24 bg-backdrop border border-border-subtle rounded-lg px-3 py-1.5 text-[13px] text-primary focus:outline-none focus:border-accent/60 font-secondary"
              />
              <div className="flex flex-wrap gap-2 ml-2">
                 {[
                   { label: '2020s', from: 2020, to: 2029 },
                   { label: '2010s', from: 2010, to: 2019 },
                   { label: '2000s', from: 2000, to: 2009 },
                 ].map(decade => {
                   const isActive = yearFrom === decade.from && yearTo === decade.to;
                   return (
                     <AnimatedChip
                       key={decade.label}
                       onClick={() => isActive ? updateFilters({ yearFrom: null, yearTo: null }) : updateFilters({ yearFrom: decade.from, yearTo: decade.to })}
                       isActive={isActive}
                     >
                       {decade.label}
                     </AnimatedChip>
                   );
                 })}
              </div>
            </div>
          </div>

         <div className="flex-[2] space-y-3">
           <h3 className="text-[13px] font-semibold text-secondary uppercase tracking-wider font-secondary">Genres</h3>
           <div className="flex flex-wrap gap-2">
             {standardGenres.map(g => {
               const isActive = genres.includes(g);
               return (
                 <AnimatedCheckbox
                   key={g}
                   onChange={() => toggleGenre(g)}
                   checked={isActive}
                   label={g}
                 />
               );
             })}
           </div>
         </div>
       </div>

    </div>
  );
};

export default React.memo(LibraryAdvancedFilters);
