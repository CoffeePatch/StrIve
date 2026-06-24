import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Check } from 'lucide-react';
import Carousel from '../ui/Carousel';
import MediaCard from '../ui/MediaCard';
import tmdbApiService from '../../services/tmdb/tmdbApiService';

const BecauseYouWatched = ({ recentlyWatchedItems = [], onQuickActions }) => {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  
  const [selectedItem, setSelectedItem] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);

  // Take top 5 recently watched items
  const topItems = recentlyWatchedItems.slice(0, 5);

  // Initialize selected item on mount
  useEffect(() => {
    if (topItems.length > 0 && !selectedItem) {
      setSelectedItem(topItems[0]);
    }
  }, [topItems, selectedItem]);

  // Fetch recommendations when selected item changes
  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!selectedItem) return;
      setLoading(true);
      try {
        const isTV = selectedItem.mediaType === 'tv' || selectedItem.media_type === 'tv';
        const mediaType = isTV ? 'tv' : 'movie';
        
        const data = await tmdbApiService.get(`/${mediaType}/${selectedItem.id}/recommendations`, { page: 1 });
        
        const mapMedia = item => ({
          id: item.id,
          name: item.title || item.name,
          title: item.title || item.name,
          posterPath: item.poster_path,
          voteAverage: item.vote_average,
          firstAirDate: item.release_date || item.first_air_date,
          mediaType: mediaType,
          media_type: mediaType
        });

        setRecommendations((data?.results || []).map(mapMedia));
      } catch (err) {
        console.error('Failed to fetch because you watched recommendations:', err);
        setRecommendations([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [selectedItem]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    if (dropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownOpen]);

  if (topItems.length === 0 || (!loading && recommendations.length === 0)) {
    return null;
  }

  return (
    <div className="mb-12">
      {/* Header section with inline dropdown */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 z-20 relative gap-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 w-full">
          <h2 className="text-xl md:text-2xl font-bold text-[var(--color-text-primary)] font-display tracking-tight flex items-center gap-2 whitespace-nowrap">
            <span className="material-symbols-outlined text-[var(--color-accent-primary)]">magic_button</span>
            Because you watched
          </h2>
          
          {/* Custom Dropdown */}
          <div className="relative w-full sm:w-auto mt-1 sm:mt-0" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center justify-between sm:justify-start gap-2 text-lg md:text-xl font-bold text-white bg-white/5 hover:bg-white/10 px-3 py-1.5 sm:py-1 md:py-1.5 rounded-lg border border-white/10 transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent-primary)] w-full sm:w-auto"
            >
              <span className="truncate text-left max-w-full sm:max-w-[200px] md:max-w-[300px]">
                {selectedItem?.title || selectedItem?.name}
              </span>
              <ChevronDown className={`w-4 h-4 md:w-5 md:h-5 text-white/60 transition-transform duration-200 flex-shrink-0 ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {dropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-64 md:w-80 bg-[#141414]/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden animate-fade-in origin-top-left">
                <div className="py-2">
                  {topItems.map(item => {
                    const isSelected = selectedItem?.id === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setSelectedItem(item);
                          setDropdownOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors ${isSelected ? 'bg-white/[0.03]' : ''}`}
                      >
                        <div className="flex flex-col truncate pr-4">
                          <span className={`truncate font-semibold text-sm ${isSelected ? 'text-white' : 'text-white/80'}`}>
                            {item.title || item.name}
                          </span>
                          <span className="text-xs text-white/40 mt-0.5">
                            {item.mediaType === 'tv' || item.media_type === 'tv' ? 'Series' : 'Movie'}
                          </span>
                        </div>
                        {isSelected && (
                          <Check className="w-4 h-4 text-[var(--color-accent-primary)] flex-shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content section */}
      <div className="relative min-h-[250px]">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
             <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#E50914]"></div>
          </div>
        ) : (
          <Carousel>
            {recommendations.map((media) => (
              <MediaCard
                key={media.id}
                media={media}
                variant="carousel"
                onClick={() => {
                  const isTV = media.mediaType === 'tv' || media.media_type === 'tv';
                  navigate(isTV ? `/shows/${media.id}` : `/movie/${media.id}`);
                }}
                onQuickActions={onQuickActions}
              />
            ))}
          </Carousel>
        )}
      </div>
    </div>
  );
};

export default BecauseYouWatched;
