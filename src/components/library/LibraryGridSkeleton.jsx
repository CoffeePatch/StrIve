import React from 'react';

const LibraryGridSkeleton = ({ viewMode = 'grid' }) => {
  const isWide = viewMode === 'wide' || viewMode === 'bookshelf';
  const skeletonCount = 12;

  const getContainerClass = () => {
    return isWide
      ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'
      : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6';
  };

  return (
    <div className={getContainerClass()}>
      {Array.from({ length: skeletonCount }).map((_, idx) => (
        <div key={idx} className={isWide ? "glass-effect rounded-xl p-3 border border-white/5 flex items-start gap-4" : "flex flex-col w-full"}>
          {isWide ? (
            <>
              {/* Wide Mode Skeleton */}
              <div className="flex-shrink-0 w-[72px] h-[108px] rounded-lg bg-white/5 animate-pulse" />
              <div className="flex-1 flex flex-col justify-between py-1 h-full">
                <div className="space-y-2 mt-1">
                  <div className="w-3/4 h-4 bg-white/5 rounded animate-pulse" />
                  <div className="w-1/2 h-3 bg-white/5 rounded animate-pulse" />
                </div>
                <div className="w-10 h-6 bg-white/5 rounded animate-pulse mt-auto" />
              </div>
            </>
          ) : (
            <>
              {/* Grid Mode Skeleton */}
              <div className="w-full aspect-[2/3] rounded-[12px] bg-white/5 animate-pulse" />
              <div className="mt-3 flex flex-col gap-2 px-1">
                <div className="w-full h-4 bg-white/5 rounded animate-pulse" />
                <div className="flex justify-between items-center w-full">
                  <div className="w-1/3 h-3 bg-white/5 rounded animate-pulse" />
                  <div className="w-10 h-3 bg-white/5 rounded animate-pulse" />
                </div>
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
};

export default LibraryGridSkeleton;
