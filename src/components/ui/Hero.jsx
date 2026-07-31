import React, { useState, useEffect } from 'react';
import { Play, Check, Info } from 'lucide-react';
import { IMG_CDN_URL, HERO_BACKDROP_CDN_URL } from '../../util/core/constants';
import { useNavigate } from 'react-router-dom';
import tmdbApiService from '../../services/tmdb/tmdbApiService';
import { sessionCache } from '../../util/cache/sessionCache';

const Hero = ({ movies }) => {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [logos, setLogos] = useState(() => {
    return sessionCache.get("hero_logos") || {};
  });
  const [bgUrls, setBgUrls] = useState({ current: null, prev: null });
  const [fadeState, setFadeState] = useState('idle'); // 'fading' | 'idle'

  useEffect(() => {
    if (!movies || movies.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % movies.length);
    }, 8000); // Auto-slide every 8 seconds

    return () => clearInterval(interval);
  }, [movies]);

  const media = movies && movies.length > 0 ? movies[currentIndex] : null;
  const type = media ? (media.mediaType || media.media_type || (media.firstAirDate || media.first_air_date || media.name ? 'tv' : 'movie')) : null;

  useEffect(() => {
    if (!movies || movies.length === 0) return;

    const isMounted = { current: true };

    const fetchLogo = async (movie) => {
      if (!movie) return;
      
      const currentCached = sessionCache.get("hero_logos") || {};
      if (currentCached[movie.id]) {
        if (isMounted.current) {
          setLogos((prev) => {
            if (prev[movie.id]) return prev;
            return { ...prev, [movie.id]: currentCached[movie.id] };
          });
        }
        return;
      }

      const mType = movie.mediaType || movie.media_type || (movie.firstAirDate || movie.first_air_date || movie.name ? 'tv' : 'movie');
      try {
        const details = await tmdbApiService.getDetails(mType, movie.id);
        if (!isMounted.current) return;
        
        if (details?.images?.logos?.length > 0) {
          const enLogo = details.images.logos.find((l) => l.iso_639_1 === 'en');
          const neutralLogo = details.images.logos.find((l) => !l.iso_639_1);
          const logoPath = enLogo ? enLogo.file_path : (neutralLogo ? neutralLogo.file_path : details.images.logos[0].file_path);
          
          if (logoPath) {
            const logoUrlVal = `https://image.tmdb.org/t/p/w500${logoPath}`;
            setLogos((prev) => {
              const updated = { ...prev, [movie.id]: logoUrlVal };
              sessionCache.set("hero_logos", updated, 24 * 60 * 60 * 1000);
              return updated;
            });
          }
        }
      } catch (err) {
        console.error(`Failed to fetch logo for movie ${movie.id}:`, err);
      }
    };

    // 1. Immediately fetch active movie logo
    const activeMovie = movies[currentIndex];
    if (activeMovie) {
      fetchLogo(activeMovie);
    }

    // 2. Fetch remaining logos concurrently in background
    movies.forEach((movie) => {
      if (movie.id !== activeMovie?.id) {
        fetchLogo(movie);
      }
    });

    return () => {
      isMounted.current = false;
    };
  }, [movies, currentIndex]);

  const logoUrl = media ? logos[media.id] : null;

  const title = media?.title || media?.name || media?.original_title || media?.original_name;
  const rawDate = media?.releaseDate || media?.firstAirDate || media?.release_date || media?.first_air_date;
  const year = media?.releaseYear && media.releaseYear !== "N/A" ? media.releaseYear : (rawDate ? new Date(rawDate).getFullYear() : null);
  const rating = media?.rating?.score || media?.voteAverage || media?.vote_average;
  const overview = media?.overview || media?.description;

  const rawBackdropPath = media?.backdropPath || media?.backdrop_path;
  const backdropUrl = rawBackdropPath
    ? (rawBackdropPath.startsWith('http') ? rawBackdropPath : `${HERO_BACKDROP_CDN_URL}${rawBackdropPath}`)
    : null;

  useEffect(() => {
    if (!backdropUrl) return;
    
    if (bgUrls.current && bgUrls.current !== backdropUrl) {
      setBgUrls({ current: backdropUrl, prev: bgUrls.current });
      setFadeState('fading');
      
      const timer = setTimeout(() => {
        setFadeState('idle');
      }, 700); // match transition duration
      
      return () => clearTimeout(timer);
    } else if (!bgUrls.current) {
      setBgUrls({ current: backdropUrl, prev: null });
    }
  }, [backdropUrl]);

  if (!media) return null;

  return (
    <>
      {/* Global Page Background Blur Effect */}
      {bgUrls.current && (
        <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden">
          <img 
            src={bgUrls.current} 
            alt="" 
            className="w-full h-full object-cover opacity-20 blur-[100px] scale-125 transition-opacity duration-700 ease-in-out"
          />
          <div className="absolute inset-0 bg-black/80" />
        </div>
      )}

      <div className="relative w-full h-[70vh] lg:h-[80vh] flex items-end pb-12 sm:pb-16 md:pb-20 lg:pb-24 mb-12 overflow-hidden">
        {/* Background Image with smooth crossfade */}
        <div className="absolute inset-0 z-0">
          {bgUrls.prev && fadeState === 'fading' && (
            <img 
              src={bgUrls.prev} 
              alt="" 
              className="absolute inset-0 w-full h-full object-cover object-[right_30%_center] min-[1100px]:object-center"
              style={{
                animation: 'fadeOutBg 700ms cubic-bezier(0.25, 1, 0.5, 1) forwards'
              }}
            />
          )}
          {bgUrls.current && (
            <img 
              src={bgUrls.current} 
              alt={title} 
              className="absolute inset-0 w-full h-full object-cover object-[right_30%_center] min-[1100px]:object-center"
              style={{
                animation: fadeState === 'fading' ? 'fadeInBg 700ms cubic-bezier(0.25, 1, 0.5, 1) forwards' : 'none',
                opacity: fadeState === 'fading' ? undefined : 0.9
              }}
            />
          )}
          {/* Custom UI/UX Spec Gradients */}
          <div 
            className="absolute inset-0 pointer-events-none" 
            style={{
              background: `linear-gradient(to right, rgba(0, 0, 0, 0.95) 35%, rgba(0, 0, 0, 0.4) 65%, rgba(0, 0, 0, 0) 100%), linear-gradient(to top, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 25%)`
            }}
          />
        </div>

        {/* Content */}
        <div key={`hero-content-${currentIndex}`} className="relative z-10 px-4 sm:px-8 lg:px-12 max-w-full mt-20">
          {logoUrl ? (
            <div className="h-[120px] sm:h-[140px] md:h-[160px] flex items-end mb-6">
              <img 
                src={logoUrl} 
                alt={title} 
                className="max-w-[30vw] max-h-full object-contain z-[2] drop-shadow-2xl filter brightness-0 invert hero-slide-title transition-opacity duration-300" 
                style={{ filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.5))" }}
              />
            </div>
          ) : (
            <div className="h-[120px] sm:h-[140px] md:h-[160px] flex items-end mb-6">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-primary font-bold text-white tracking-tight leading-tight drop-shadow-lg hero-slide-title max-w-[40vw] line-clamp-2" style={{ color: '#E5E0D8' }}>
                {title}
              </h1>
            </div>
          )}
          
          <div className="flex items-center gap-4 text-sm font-semibold text-white/80 mb-6 drop-shadow-md tracking-wide hero-slide-title" style={{ animationDelay: '140ms' }}>
            {rating > 0 && (
              <div className="flex items-center gap-1">
                <span className="text-white">★</span>
                <span>{Number(rating).toFixed(1)}/10</span>
              </div>
            )}
            {year && (
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                <span>{year}</span>
              </div>
            )}
            {/* Assuming generic label if genres not available */}
            <div className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">category</span>
              <span className="capitalize">{type === 'tv' ? 'Series' : 'Movie'}</span>
            </div>
          </div>

          <p className="text-white/90 text-lg lg:text-xl font-medium mb-8 leading-snug drop-shadow-md line-clamp-4 max-w-full md:max-w-[35vw] hero-slide-desc">
            {overview}
          </p>

          <div className="flex items-center gap-4 hero-slide-btn">
            <button 
              onClick={() => navigate(`/${type === 'tv' ? 'shows' : 'movie'}/${media.id}`)}
              className="play-btn flex items-center justify-center gap-2 px-8 py-3 rounded-full bg-white text-black font-bold transition-all shadow-lg interactive-element"
            >
              <Play className="w-5 h-5 fill-black" />
              <span>PLAY</span>
            </button>
            
            <button className="circle-btn flex items-center justify-center w-12 h-12 rounded-full border-2 border-white/40 text-white transition-all backdrop-blur-sm interactive-element">
              <Check className="w-5 h-5" />
            </button>
            
            <button className="circle-btn flex items-center justify-center w-12 h-12 rounded-full border-2 border-white/40 text-white transition-all backdrop-blur-sm interactive-element">
              <Info className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Pagination dots */}
        <div className="absolute right-12 bottom-24 flex items-center gap-2 z-10 hidden md:flex">
          {movies.map((_, i) => (
            <button 
              key={i} 
              onClick={() => setCurrentIndex(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${i === currentIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60'}`} 
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      </div>
    </>
  );
};

export default Hero;
