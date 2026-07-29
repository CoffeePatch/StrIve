import React from 'react';
import Header from '../layout/Header';
import LibraryHeaderBar from './LibraryHeaderBar';
import LibraryFilterBar from './LibraryFilterBar';
import LibraryEmptyState from './LibraryEmptyState';
import LibraryGrid from './LibraryGrid';
import LibraryGridSkeleton from './LibraryGridSkeleton';

const LibraryDesktopView = ({
  headerProps = {},
  filterProps = {},
  gridProps = {},
  loading = false,
  message = null,
}) => {
  const { totalItems = 0, items = [] } = gridProps;

  return (
    <div className="hidden md:flex min-h-screen premium-page flex-col bg-background">
      <Header />

      <div className="pt-[100px] pb-8 w-full">
        {/* Library Header Controls */}
        <LibraryHeaderBar {...headerProps} />

        {/* Filter Controls Bar */}
        <LibraryFilterBar {...filterProps} />

        {/* Main Content Area */}
        <main className="flex-grow w-full px-8 pb-20 max-w-[1440px] mx-auto">
          <div className="max-w-full mx-auto space-y-8">
            {message && (
              <div
                className={`glass-effect px-6 py-4 rounded-lg ${
                  message.type === 'error'
                    ? 'bg-error/20 text-error border border-error/30'
                    : 'bg-success/20 text-success border border-success/30'
                }`}
              >
                {message.text}
              </div>
            )}

            {loading && (
              <div className="w-full">
                <LibraryGridSkeleton viewMode={headerProps.viewMode} />
              </div>
            )}

            {!loading && (items.length === 0 || totalItems === 0) && (
              <LibraryEmptyState totalItems={totalItems} filteredCount={items.length} />
            )}

            {!loading && items.length > 0 && (
              <LibraryGrid
                items={items}
                viewMode={headerProps.viewMode}
                handleItemClick={gridProps.handleItemClick}
                handleRemove={gridProps.handleRemove}
                onQuickActions={gridProps.onQuickActions}
                getImdbRating={gridProps.getImdbRating}
                getImdbVotes={gridProps.getImdbVotes}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default React.memo(LibraryDesktopView);
