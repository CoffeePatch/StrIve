import React from 'react';

const LibraryEmptyState = ({ totalItems = 0, filteredCount = 0 }) => {
  if (totalItems === 0) {
    return (
      <div className="glass-effect rounded-2xl p-12 text-center border border-border-subtle bg-surface">
        <span className="material-symbols-outlined text-6xl text-muted mb-4 block">inbox</span>
        <p className="text-secondary font-secondary text-base">
          Your library is empty. Search for movies or shows to add them!
        </p>
      </div>
    );
  }

  if (filteredCount === 0) {
    return (
      <div className="glass-effect rounded-2xl p-12 text-center border border-border-subtle bg-surface">
        <span className="material-symbols-outlined text-6xl text-muted mb-4 block">search_off</span>
        <p className="text-secondary font-secondary text-base">No items match your filters.</p>
      </div>
    );
  }

  return null;
};

export default React.memo(LibraryEmptyState);
