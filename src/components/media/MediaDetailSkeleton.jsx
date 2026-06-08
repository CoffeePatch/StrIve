import React from 'react';
import Header from '../layout/Header';

const MediaDetailSkeleton = () => {
  return (
    <div className="min-h-screen premium-page pt-20">
      <Header />
      
      {/* Hero Section Skeleton */}
      <div className="relative w-full h-[60vh] md:h-[70vh] lg:h-[80vh] bg-black/40 animate-pulse">
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f1014] via-[#0f1014]/60 to-transparent"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-[#0f1014] via-[#0f1014]/80 to-transparent"></div>
        
        <div className="absolute bottom-0 left-0 w-full px-6 lg:px-12 pb-12 z-10 flex flex-col items-start gap-4">
          <div className="max-w-3xl w-full">
            {/* Title / Logo */}
            <div className="h-16 w-3/4 bg-white/5 rounded-lg mb-4"></div>
            
            {/* Metadata (Year, Duration) */}
            <div className="flex gap-4 mb-6">
              <div className="h-5 w-16 bg-white/5 rounded"></div>
              <div className="h-5 w-20 bg-white/5 rounded"></div>
              <div className="h-5 w-24 bg-white/5 rounded"></div>
            </div>
            
            {/* Overview */}
            <div className="space-y-2 mb-8">
              <div className="h-4 w-full bg-white/5 rounded"></div>
              <div className="h-4 w-11/12 bg-white/5 rounded"></div>
              <div className="h-4 w-4/5 bg-white/5 rounded"></div>
            </div>
            
            {/* Ratings */}
            <div className="flex gap-4 mb-8">
              <div className="h-10 w-24 bg-white/5 rounded-lg"></div>
              <div className="h-10 w-24 bg-white/5 rounded-lg"></div>
            </div>
            
            {/* Actions */}
            <div className="flex gap-4">
              <div className="h-12 w-32 bg-white/5 rounded-lg text-red-600/50"></div>
              <div className="h-12 w-12 bg-white/5 rounded-full"></div>
              <div className="h-12 w-12 bg-white/5 rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Cast & Similar Section Skeleton */}
      <div className="w-full px-6 lg:px-12 py-16">
        <div className="max-w-7xl mx-auto space-y-10">
          <div>
            <div className="h-8 w-48 bg-white/5 rounded mb-6"></div>
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[120px]">
                  <div className="w-[120px] h-[180px] bg-white/5 rounded-lg mb-2"></div>
                  <div className="h-3 w-3/4 bg-white/5 rounded mb-1"></div>
                  <div className="h-3 w-1/2 bg-white/5 rounded"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaDetailSkeleton;
