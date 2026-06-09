import React from 'react';

const PageLoader = () => {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black">
      <div className="flex flex-col items-center gap-4">
        {/* Simple lightweight CSS spinner using Tailwind animate-spin */}
        <div className="w-10 h-10 rounded-full border-2 border-white/10 border-t-red-600 animate-spin" />
        
        {/* Subtle pulsing loading message */}
        <div className="flex items-center gap-2 animate-pulse">
          <span className="text-white/60 font-secondary text-xs font-medium tracking-wider uppercase">
            Loading
          </span>
        </div>
      </div>
    </div>
  );
};

export default PageLoader;
