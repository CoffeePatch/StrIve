import React from 'react';
import { List, LayoutGrid, Table } from 'lucide-react';

const EpisodeViewToggle = ({ viewMode, setViewMode }) => {
  const baseStyle = "p-2 rounded-md transition-colors duration-150 focus-accent cursor-pointer";
  const activeStyle = "bg-gray-700 text-white";
  const inactiveStyle = "text-gray-500 hover:text-white hover:bg-gray-700";

  return (
    <div role="group" aria-label="Episode view options" className="flex gap-2">
      <button
        aria-label="Switch to List View"
        aria-pressed={viewMode === 'list'}
        onClick={() => setViewMode('list')}
        className={`${baseStyle} ${viewMode === 'list' ? activeStyle : inactiveStyle}`}
        type="button"
      >
        <List className="w-5 h-5" />
      </button>
      <button
        aria-label="Switch to Grid View"
        aria-pressed={viewMode === 'grid'}
        onClick={() => setViewMode('grid')}
        className={`${baseStyle} ${viewMode === 'grid' ? activeStyle : inactiveStyle}`}
        type="button"
      >
        <LayoutGrid className="w-5 h-5" />
      </button>
      <button
        aria-label="Switch to Matrix View"
        aria-pressed={viewMode === 'matrix'}
        onClick={() => setViewMode('matrix')}
        className={`${baseStyle} ${viewMode === 'matrix' ? activeStyle : inactiveStyle}`}
        type="button"
      >
        <Table className="w-5 h-5" />
      </button>
    </div>
  );
};

export default EpisodeViewToggle;
