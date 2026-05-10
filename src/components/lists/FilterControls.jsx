import React, { useState, useMemo } from 'react';

const FilterControls = ({ items, children }) => {
  const [filterType, setFilterType] = useState('all'); // all, movie, tv
  const [sortType, setSortType] = useState('dateAddedDesc'); // dateAddedDesc, titleAsc, voteAverageDesc

  const filteredAndSortedItems = useMemo(() => {
    let filtered = [...items];

    // Filtering logic
    if (filterType !== 'all') {
      filtered = filtered.filter(item => {
        const itemType = item.media_type || (item.first_air_date ? 'tv' : 'movie');
        return itemType === filterType;
      });
    }

    // Sorting logic
    if (sortType === 'dateAddedDesc') {
      filtered.sort((a, b) => new Date(b.dateAdded) - new Date(a.dateAdded));
    } else if (sortType === 'titleAsc') {
      filtered.sort((a, b) => (a.title || a.name).localeCompare(b.title || b.name));
    } else if (sortType === 'voteAverageDesc') {
      filtered.sort((a, b) => b.vote_average - a.vote_average);
    }

    return filtered;
  }, [items, filterType, sortType]);

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-center mb-6">
        <div className="flex items-center space-x-4 mb-4 md:mb-0">
          <label>Filter by:</label>
          <select onChange={(e) => setFilterType(e.target.value)} value={filterType} className="bg-gray-700 text-white p-2 rounded">
            <option value="all">All</option>
            <option value="movie">Movies</option>
            <option value="tv">TV Shows</option>
          </select>
        </div>
        <div className="flex items-center space-x-4">
          <label>Sort by:</label>
          <select onChange={(e) => setSortType(e.target.value)} value={sortType} className="bg-gray-700 text-white p-2 rounded">
            <option value="dateAddedDesc">Date Added</option>
            <option value="titleAsc">Title (A-Z)</option>
            <option value="voteAverageDesc">Rating</option>
          </select>
        </div>
      </div>
      {children(filteredAndSortedItems)}
    </div>
  );
};

export default FilterControls;