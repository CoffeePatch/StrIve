import React from 'react';
import { Play } from 'lucide-react';

const MediaTrailers = ({ videos }) => {
  if (!videos || videos.length === 0) return null;

  // Filter for YouTube and reasonable types (Trailer, Teaser)
  const trailers = videos.filter(
    v => v.site === "YouTube" && (v.type === "Trailer" || v.type === "Teaser")
  ).slice(0, 3); // Limit to 3 for the desktop row

  if (trailers.length === 0) return null;

  return (
    <div className="mb-10 lg:mb-16">
      <div className="flex justify-center mb-6">
        <h2 className="text-xl md:text-2xl font-bold text-white tracking-wide">
          Trailers
        </h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {trailers.map((video) => (
          <a
            key={video.key}
            href={`https://www.youtube.com/watch?v=${video.key}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative aspect-video rounded-[12px] overflow-hidden bg-black/40 border border-white/5 hover:border-white/20 transition-colors shadow-lg block"
          >
            <img
              src={`https://img.youtube.com/vi/${video.key}/hqdefault.jpg`}
              alt={video.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
            
            {/* Play Button Overlay */}
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors duration-300">
              <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-black/60 group-hover:bg-[#E50914] flex items-center justify-center backdrop-blur-md transition-all duration-300 shadow-[0_0_20px_rgba(0,0,0,0.5)] group-hover:shadow-[0_0_20px_rgba(229,9,20,0.4)] group-hover:scale-110 border border-white/10">
                <Play className="w-5 h-5 md:w-6 md:h-6 text-white ml-1" fill="currentColor" />
              </div>
            </div>

            {/* Bottom Gradient for Title Readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent pointer-events-none"></div>
            
            {/* Title */}
            <div className="absolute bottom-0 left-0 w-full p-4 pointer-events-none">
              <h3 className="text-white font-bold text-sm md:text-base line-clamp-1 group-hover:text-white transition-colors">
                {video.name}
              </h3>
              <p className="text-xs text-[#9CA3AF] mt-0.5">
                {video.type}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
};

export default MediaTrailers;
