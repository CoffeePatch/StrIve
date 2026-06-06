import React, { useState } from 'react';
import { ArrowLeft, Calendar } from 'lucide-react';

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
  const [logoFailed, setLogoFailed] = useState(false);

  if (isTV) {
    let bestLogo = null;
    if (logos && logos.length > 0) {
      bestLogo = logos.find(l => l.iso_639_1 === 'en') || logos.find(l => l.iso_639_1 === null) || logos[0];
    }
    const logoUrl = bestLogo && !logoFailed ? `${IMG_CDN_URL}/w500${bestLogo.file_path || bestLogo.filePath}` : null;

    return (
      <div className="relative w-full overflow-hidden min-h-[90vh] lg:min-h-[100svh] flex flex-col justify-center">
        {/* Backdrop Layer */}
        <div 
          className="absolute inset-0 bg-cover bg-center z-0"
          style={{ backgroundImage: backdropPath ? `url(${IMG_CDN_URL}/original${backdropPath})` : 'none' }}
        >
          {/* TV Specific Gradient Overlay */}
          <div 
            className="absolute inset-0" 
            style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,1) 100%)' }}
          ></div>
          {/* Radial darkening behind the poster on desktop */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,_var(--tw-gradient-stops))] from-black/60 via-transparent to-transparent hidden md:block"></div>
        </div>

        {/* Back Button */}
        {onBack && (
          <button
            onClick={onBack}
            className="absolute top-6 left-6 z-20 p-3 rounded-full focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)] focus-visible:outline-none transition-all cursor-pointer bg-black/60 hover:bg-black/80 shadow-lg"
            aria-label="Back to Shows"
          >
            <ArrowLeft className="w-6 h-6 text-white" />
          </button>
        )}

        {/* Hero Content Layout */}
        <div className="relative z-10 w-full max-w-[1280px] mx-auto px-4 md:px-8 lg:px-12 pt-24 pb-12 lg:pt-32 lg:pb-16 flex flex-col items-center md:items-start md:grid grid-cols-1 md:grid-cols-[240px_1fr] lg:grid-cols-[280px_1fr] xl:grid-cols-[320px_1fr] gap-8 md:gap-10 lg:gap-12">
          
          {/* Poster Column */}
          <div className="w-48 sm:w-56 md:w-full flex-shrink-0 z-20">
            <div className="w-full aspect-[2/3] rounded-[12px] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.5)] ring-1 ring-white/10 bg-black/40">
              {posterPath ? (
                <img
                  src={`${IMG_CDN_URL}/w500${posterPath}`}
                  alt={`${title} poster`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/50 bg-white/5">
                  No Poster
                </div>
              )}
            </div>
          </div>

          {/* Info Column */}
          <div className="w-full flex flex-col items-center md:items-start text-center md:text-left z-20 pt-2 lg:pt-6">
            
            {/* Title Logo Block */}
            <div className="mb-4 lg:mb-6 flex justify-center md:justify-start w-full">
              {/* Semantic hidden title for accessibility when logo is shown */}
              <h1 className={logoUrl ? "sr-only" : "text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white drop-shadow-lg"}>
                {title}
              </h1>
              
              {logoUrl && (
                <img
                  src={logoUrl}
                  alt={title}
                  className="max-w-[70vw] md:max-w-[300px] lg:max-w-[350px] max-h-[90px] lg:max-h-[110px] object-contain drop-shadow-2xl"
                  onError={() => setLogoFailed(true)}
                />
              )}
            </div>

            {/* Metadata Row */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mb-6">
              {ratingsComponent}
              
              {releaseYear && (
                <div className="flex items-center gap-1.5 text-[14px] text-[#E5E7EB]">
                  <Calendar className="w-4 h-4 text-[#9CA3AF]" />
                  <span>{releaseYear}</span>
                </div>
              )}
              
              {durationOrSeasons && (
                <div className="text-[14px] text-[#E5E7EB]">
                  {durationOrSeasons}
                </div>
              )}

              {status && (
                <span className="px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-white/10 text-white border border-white/20">
                  {status}
                </span>
              )}
            </div>

            {genresComponent && (
              <div className="mb-6 w-full max-w-[700px] flex justify-center md:justify-start">
                {genresComponent}
              </div>
            )}

            {/* Synopsis Block */}
            {overview && (
              <div className="mb-8 w-full max-w-[700px]">
                <p className="text-[15px] lg:text-[16px] leading-relaxed text-[#D1D5DB] line-clamp-3">
                  {overview}
                </p>
              </div>
            )}

            {/* Action Buttons Group */}
            {actionsComponent && (
              <div className="w-full flex justify-center md:justify-start">
                {actionsComponent}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // --- MOVIE HERO (Original) ---
  return (
    <div className="relative h-screen">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: backdropPath ? `url(${IMG_CDN_URL}/original${backdropPath})` : 'none' }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/50"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent"></div>
      </div>

      <div className="relative z-10 h-full flex items-end">
        <div className="w-full px-6 lg:px-12 pb-20">
          <div className="max-w-5xl">
            <div>
              {logos && logos.length > 0 ? (
                <div className="mb-6">
                  <img
                    src={`${IMG_CDN_URL}/w500${logos[0].file_path || logos[0].filePath}`}
                    alt={`${title} Logo`}
                    className="max-w-full h-auto object-contain max-h-40 drop-shadow-2xl"
                  />
                </div>
              ) : (
                <h1 className="font-bold tracking-tight text-white font-display text-6xl lg:text-7xl mb-6 drop-shadow-2xl">
                  {title}
                </h1>
              )}

              <div className="flex flex-wrap items-center gap-3 lg:gap-4 text-lg mb-6 font-secondary">
                {releaseYear && (
                  <span className="text-white/90 font-semibold">
                    {releaseYear}
                  </span>
                )}
                {durationOrSeasons && (
                  <span className="text-white/90">
                    {durationOrSeasons}
                  </span>
                )}
                {status && (
                  <span className="glass-effect px-3 py-1 rounded-full text-sm text-white/90">
                    {status}
                  </span>
                )}
                {ratingsComponent}
              </div>

              {overview && (
                <p className="leading-relaxed max-w-3xl text-xl text-white/80 mb-8 font-primary">
                  {overview}
                </p>
              )}

              {actionsComponent && (
                <div className="mb-8">
                  {actionsComponent}
                </div>
              )}

              {genresComponent && (
                <div>
                  {genresComponent}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MediaHero;
