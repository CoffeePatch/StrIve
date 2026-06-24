import React from 'react';
import Header from '../layout/Header';

const MediaDetailSkeleton = () => {
  return (
    <div className="min-h-screen premium-page pt-20">
      <Header />
      
      <div className="amoled-page">
        {/* Hero Section Skeleton */}
        <div className="relative w-full overflow-hidden min-h-[90vh] lg:min-h-[100svh] flex flex-col justify-center animate-pulse">
          {/* Backdrop Layer */}
          <div className="absolute inset-0 bg-black/40 z-0">
            <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,1) 100%)' }}></div>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,_var(--tw-gradient-stops))] from-black/60 via-transparent to-transparent hidden md:block"></div>
          </div>
          
          {/* Hero Content Layout */}
          <div className="relative z-10 w-full max-w-[1280px] mx-auto px-4 md:px-8 lg:px-12 pt-24 pb-12 lg:pt-32 lg:pb-16 flex flex-col items-center md:items-start md:grid grid-cols-1 md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr] xl:grid-cols-[320px_1fr] gap-8 md:gap-10 lg:gap-12">
            
            {/* Poster Column */}
            <div className="w-48 sm:w-56 md:w-full flex-shrink-0 z-20">
              <div className="w-full aspect-[2/3] rounded-[12px] bg-white/5 ring-1 ring-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.5)]"></div>
            </div>

            {/* Info Column */}
            <div className="w-full flex flex-col items-center md:items-start text-center md:text-left z-20 pt-2 lg:pt-6">
              
              {/* Title Logo Block */}
              <div className="mb-4 lg:mb-6 flex justify-center md:justify-start w-full">
                <div className="h-12 md:h-16 w-3/4 max-w-[350px] bg-white/5 rounded-lg"></div>
              </div>

              {/* Metadata Row */}
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mb-6">
                <div className="h-6 w-32 bg-white/5 rounded"></div>
                <div className="h-5 w-16 bg-white/5 rounded"></div>
                <div className="h-5 w-20 bg-white/5 rounded"></div>
              </div>

              {/* Genres */}
              <div className="mb-6 w-full max-w-[700px] flex justify-center md:justify-start gap-2">
                <div className="h-8 w-20 bg-white/5 rounded-full"></div>
                <div className="h-8 w-24 bg-white/5 rounded-full"></div>
                <div className="h-8 w-16 bg-white/5 rounded-full"></div>
              </div>

              {/* Synopsis Block */}
              <div className="mb-8 w-full max-w-[700px] space-y-3">
                <div className="h-4 w-full bg-white/5 rounded"></div>
                <div className="h-4 w-11/12 bg-white/5 rounded"></div>
                <div className="h-4 w-4/5 bg-white/5 rounded"></div>
              </div>

              {/* Action Buttons Group */}
              <div className="w-full max-w-[700px] flex flex-col gap-3 justify-center md:justify-start mt-2">
                {/* Primary CTA */}
                <div className="w-full h-14 bg-white/5 border border-white/10 rounded-full"></div>
                {/* Secondary Actions Row */}
                <div className="hidden md:flex flex-col sm:flex-row gap-3 w-full">
                  <div className="flex-1 h-12 bg-white/10 border border-white/10 rounded-full"></div>
                  <div className="flex-1 h-12 bg-white/10 border border-white/10 rounded-full"></div>
                  <div className="flex-1 h-12 bg-white/10 border border-white/10 rounded-full"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cast & Similar Section Skeleton */}
        <div className="premium-container pt-10 pb-24 md:pb-10">
          <div className="mx-auto max-w-[1600px] space-y-10">
            <div>
              <div className="h-6 md:h-8 w-48 bg-white/5 rounded mb-6"></div>
              <div className="flex gap-4 overflow-hidden">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex-shrink-0 w-[140px] sm:w-[160px]">
                    <div className="w-full aspect-[2/3] bg-white/5 rounded-lg mb-2"></div>
                    <div className="h-3 w-3/4 bg-white/5 rounded mb-1"></div>
                    <div className="h-3 w-1/2 bg-white/5 rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaDetailSkeleton;
