import React from 'react';
import { ArrowLeft } from 'lucide-react';

const IMG_CDN_URL = "https://image.tmdb.org/t/p";

const MediaHero = ({ 
  backdropPath, 
  layoutType = "movie",
  posterPath,
  logos, 
  title, 
  releaseYear, 
  durationOrSeasons,
  status,
  overview,
  onBack,
  ratingsComponent,
  actionsComponent,
  genresComponent
}) => {
  const isTV = layoutType === "tv";

  return (
    <div className={`relative ${isTV ? 'min-h-[60vh]' : 'h-screen'}`}>
      
      {isTV ? (
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: backdropPath ? `url(${IMG_CDN_URL}/original${backdropPath})` : 'none' }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/55 to-black/20"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent"></div>
        </div>
      ) : (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: backdropPath ? `url(${IMG_CDN_URL}/original${backdropPath})` : 'none' }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/50"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent"></div>
        </div>
      )}

      {isTV && onBack && (
        <button
          onClick={onBack}
          className="absolute top-6 left-6 z-20 p-3 rounded-full focus-accent transition-all cursor-pointer"
          style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
          aria-label="Back"
        >
          <ArrowLeft className="w-6 h-6 text-white" />
        </button>
      )}

      <div className={`relative z-10 ${isTV ? 'min-h-[60vh] flex items-center' : 'h-full flex items-end'}`}>
        <div className={isTV ? 'premium-container w-full' : 'w-full px-6 lg:px-12 pb-20'}>
          <div className={isTV ? 'mx-auto max-w-[1600px] py-6 lg:py-10' : 'max-w-5xl'}>
            <div className={isTV ? 'flex flex-col lg:flex-row gap-6 lg:gap-8 items-center lg:justify-center' : ''}>
              
              {isTV && posterPath && (
                <div className="w-32 sm:w-40 md:w-48 lg:w-56 flex-shrink-0 self-center lg:self-auto">
                  <div className="rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-black/40">
                    <img
                      src={`${IMG_CDN_URL}/w500${posterPath}`}
                      alt={title}
                      className="w-full h-auto object-cover"
                      loading="lazy"
                    />
                  </div>
                </div>
              )}

              <div className={isTV ? 'w-full max-w-3xl lg:w-auto' : ''}>
                {logos && logos.length > 0 ? (
                  <div className={isTV ? 'mb-4' : 'mb-6'}>
                    <img
                      src={`${IMG_CDN_URL}/w500${logos[0].file_path || logos[0].filePath}`}
                      alt={`${title} Logo`}
                      className={`max-w-full h-auto object-contain ${isTV ? 'max-h-24' : 'max-h-40 drop-shadow-2xl'}`}
                      style={isTV ? { maxWidth: '420px' } : undefined}
                    />
                  </div>
                ) : (
                  <h1 
                    className={`font-bold tracking-tight text-white ${isTV ? 'text-5xl md:text-6xl mb-3' : 'font-display text-6xl lg:text-7xl mb-6 drop-shadow-2xl'}`}
                  >
                    {title}
                  </h1>
                )}

                <div className={`flex flex-wrap items-center gap-3 lg:gap-4 text-lg ${isTV ? 'mb-4' : 'mb-6 font-secondary'}`}>
                  {releaseYear && (
                    <span className={isTV ? 'text-[#ff3b3b] font-semibold' : 'text-white/90 font-semibold'}>
                      {releaseYear}
                    </span>
                  )}
                  {durationOrSeasons && (
                    <span className={isTV ? 'text-white' : 'text-white/90'}>
                      {durationOrSeasons}
                    </span>
                  )}
                  {status && (
                    <span className={isTV ? 'px-2.5 py-1 rounded text-xs font-medium bg-[#ff3b3b] text-black' : 'glass-effect px-3 py-1 rounded-full text-sm text-white/90'}>
                      {status}
                    </span>
                  )}
                  {ratingsComponent}
                </div>

                {overview && (
                  <p className={`leading-relaxed max-w-3xl ${isTV ? 'text-lg mb-5 text-white/70' : 'text-xl text-white/80 mb-8 font-primary'}`}>
                    {overview}
                  </p>
                )}

                {actionsComponent && (
                  <div className={isTV ? '' : 'mb-8'}>
                    {actionsComponent}
                  </div>
                )}

                {genresComponent && (
                  <div className={isTV ? 'mt-5' : ''}>
                    {genresComponent}
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaHero;
