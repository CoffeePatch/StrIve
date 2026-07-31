import React, { useState, useEffect, useRef } from "react";
import useNowPlayingMedia from "../../hooks/media/useNowPlayingMedia";
import useUpcomingMedia from "../../hooks/media/useUpcomingMedia";
import usePopularMedia from "../../hooks/media/usePopularMedia";
import useTopRatedMedia from "../../hooks/media/useTopRatedMedia";
import useMediaByGenre from "../../hooks/media/useMediaByGenre";

import Header from "../layout/Header";
import MediaCard from "../ui/MediaCard";
import Carousel from "../ui/Carousel";
import SectionHeader from "../ui/SectionHeader";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { useBrowseLibraryData } from "../../hooks/library/useBrowseLibraryData";
import { useLists } from "../../domain/lists/useLists";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../util/firebase/firebase";
import { Settings, X } from "lucide-react";
import QuickActionsModal from "../ui/QuickActionsModal";
import BecauseYouWatched from "./BecauseYouWatched";
import Hero from "../ui/Hero";

// Static skeleton loader for lazy shelves
const MediaShelfSkeleton = ({ title, icon, variant = "carousel" }) => {
  return (
    <div className="mb-12">
      <SectionHeader 
        title={title} 
        icon={<span className="material-symbols-outlined">{icon}</span>} 
      />
      <Carousel>
        {Array.from({ length: 8 }).map((_, idx) => (
          <div key={idx} className={`flex-none ${variant === 'continue_watching' ? 'w-64 sm:w-72 lg:w-80' : 'w-36 sm:w-44 lg:w-48'} flex flex-col`}>
            <div 
              className={`w-full aspect-${variant === 'continue_watching' ? 'video' : '[2/3]'} bg-gray-800/60 border border-white/5 animate-pulse rounded-[12px]`} 
            />
            {variant !== 'carousel' && (
              <div className="mt-2 flex flex-col gap-1.5 px-1 animate-pulse">
                <div className="h-4 w-3/4 bg-gray-800/60 rounded" />
                <div className="h-3 w-1/2 bg-gray-800/60 rounded" />
              </div>
            )}
          </div>
        ))}
      </Carousel>
    </div>
  );
};

// Skeleton loader for the Hero section to prevent CLS
const HeroSkeleton = () => {
  return (
    <div className="relative w-full h-[70vh] lg:h-[80vh] flex items-end pb-12 sm:pb-16 md:pb-20 lg:pb-24 mb-12 overflow-hidden bg-black/40">
      <div className="absolute inset-0 bg-gray-900/20 animate-pulse z-0" />
      {/* Custom UI/UX Spec Gradients */}
      <div 
        className="absolute inset-0 pointer-events-none z-10" 
        style={{
          background: `linear-gradient(to right, rgba(0, 0, 0, 0.95) 35%, rgba(0, 0, 0, 0.4) 65%, rgba(0, 0, 0, 0) 100%), linear-gradient(to top, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0) 25%)`
        }}
      />
      <div className="relative z-20 px-4 sm:px-8 lg:px-12 w-full max-w-full">
        {/* Title/Logo placeholder */}
        <div className="h-[120px] sm:h-[140px] md:h-[160px] w-[35vw] max-w-[300px] bg-white/5 rounded-xl animate-pulse mb-6" />
        
        {/* Rating / Year / Category row placeholder */}
        <div className="flex items-center gap-4 mb-6">
          <div className="h-5 w-16 bg-white/5 rounded-md animate-pulse" />
          <div className="h-5 w-16 bg-white/5 rounded-md animate-pulse" />
          <div className="h-5 w-20 bg-white/5 rounded-md animate-pulse" />
        </div>

        {/* Synopsis placeholder */}
        <div className="space-y-2 mb-8 w-full max-w-[35vw]">
          <div className="h-4 w-full bg-white/5 rounded-md animate-pulse" />
          <div className="h-4 w-11/12 bg-white/5 rounded-md animate-pulse" />
          <div className="h-4 w-4/5 bg-white/5 rounded-md animate-pulse" />
        </div>

        {/* Buttons placeholder */}
        <div className="flex items-center gap-4">
          <div className="w-32 h-12 rounded-full bg-white/10 animate-pulse" />
          <div className="w-12 h-12 rounded-full bg-white/5 animate-pulse" />
          <div className="w-12 h-12 rounded-full bg-white/5 animate-pulse" />
        </div>
      </div>
    </div>
  );
};

const ShelfDisplay = ({ title, icon, items, variant, onQuickActions }) => {
  const navigate = useNavigate();

  if (!items) {
    return <MediaShelfSkeleton title={title} icon={icon} variant={variant} />;
  }

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="mb-12">
      <SectionHeader 
        title={title} 
        icon={<span className="material-symbols-outlined">{icon}</span>} 
      />
      <Carousel>
        {items.map((media) => {
          if (!media) return null;
          return (
            <MediaCard 
              key={media.id} 
              media={media} 
              variant={variant}
              onClick={() => {
                const isTV = media.mediaType === 'tv' || media.media_type === 'tv';
                navigate(isTV ? `/shows/${media.id}` : `/movie/${media.id}`);
              }}
              onQuickActions={onQuickActions}
            />
          );
        })}
      </Carousel>
    </div>
  );
};

const UpcomingShelfContent = (props) => {
  const items = useUpcomingMedia(props.mediaType);
  return <ShelfDisplay {...props} items={items} />;
};

const PopularShelfContent = (props) => {
  const items = usePopularMedia(props.mediaType);
  return <ShelfDisplay {...props} items={items} />;
};

const TopRatedShelfContent = (props) => {
  const items = useTopRatedMedia(props.mediaType);
  return <ShelfDisplay {...props} items={items} />;
};

const GenreShelfContent = (props) => {
  const items = useMediaByGenre(props.mediaType, props.genreId);
  return <ShelfDisplay {...props} items={items} />;
};

const NowPlayingShelfContent = (props) => {
  const items = useNowPlayingMedia(props.mediaType);
  return <ShelfDisplay {...props} items={items} />;
};

// Content loader for lazy shelves
const MediaShelfContent = React.memo((props) => {
  const { type } = props;
  if (type === "upcoming") return <UpcomingShelfContent {...props} />;
  if (type === "popular") return <PopularShelfContent {...props} />;
  if (type === "top_rated") return <TopRatedShelfContent {...props} />;
  if (type === "genre") return <GenreShelfContent {...props} />;
  if (type === "now_playing") return <NowPlayingShelfContent {...props} />;
  return null;
});

MediaShelfContent.displayName = "MediaShelfContent";

// Intersection observer wrapper for lazy loading
const MediaShelf = React.memo(({ title, type, mediaType, genreId, icon, onQuickActions, variant = "carousel" }) => {
  const [hasBeenVisible, setHasBeenVisible] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasBeenVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "1000px 0px" } // Pre-load when within 1000px of viewport (approx 3 rows below)
    );
    
    const el = containerRef.current;
    if (el) {
      observer.observe(el);
    }
    
    return () => {
      if (el) {
        observer.unobserve(el);
      }
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className="min-h-[220px]">
      {hasBeenVisible ? (
        <MediaShelfContent
          title={title}
          type={type}
          mediaType={mediaType}
          genreId={genreId}
          icon={icon}
          onQuickActions={onQuickActions}
          variant={variant}
        />
      ) : (
        <MediaShelfSkeleton title={title} icon={icon} variant={variant} />
      )}
    </div>
  );
});

MediaShelf.displayName = "MediaShelf";

const Browse = () => {
  const navigate = useNavigate();
  const user = useSelector((store) => store.user?.user);
  const {
    continueWatching: continueWatchingItems,
    recentlyAdded: recentlyAddedItems,
    recentlyWatched: recentlyWatchedItems,
    watchlistPicks: watchlistPicksItems,
    stats,
    totalLibraryCount,
    loading,
    refetch
  } = useBrowseLibraryData(user?.uid);

  const [activeMedia, setActiveMedia] = useState(null);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [quickActionsAnchor, setQuickActionsAnchor] = useState(null);

  const handleQuickActions = (media, e) => {
    setActiveMedia(media);
    if (e && e.currentTarget) {
      const rect = e.currentTarget.getBoundingClientRect();
      setQuickActionsAnchor({ x: rect.left, y: rect.bottom, right: window.innerWidth - rect.right });
    } else {
      setQuickActionsAnchor(null);
    }
    setQuickActionsOpen(true);
  };

  // Eagerly loaded for Hero at top of viewport
  const popularMovies = usePopularMedia("movie");

  const { lists: customLists = [], loadLists } = useLists(user?.uid);
  const [preferences, setPreferences] = useState({
    continueWatching: true,
    recentlyAdded: true,
    recentlyWatched: true,
    watchlistPicks: true
  });
  const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);

  // Load custom lists
  useEffect(() => {
    if (user?.uid) {
      loadLists();
    }
  }, [user?.uid, loadLists]);

  // Load dashboard preferences from Firestore
  useEffect(() => {
    if (!user?.uid) return;
    
    const fetchPrefs = async () => {
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.dashboardPreferences) {
            setPreferences({
              continueWatching: data.dashboardPreferences.continueWatching ?? true,
              recentlyAdded: data.dashboardPreferences.recentlyAdded ?? true,
              recentlyWatched: data.dashboardPreferences.recentlyWatched ?? true,
              watchlistPicks: data.dashboardPreferences.watchlistPicks ?? true
            });
          }
        }
      } catch (err) {
        console.error("Failed to load dashboard preferences:", err);
      }
    };
    
    fetchPrefs();
  }, [user?.uid]);

  const handleTogglePreference = async (key) => {
    const nextPrefs = {
      ...preferences,
      [key]: !(preferences[key] ?? true)
    };
    setPreferences(nextPrefs);
    
    if (user?.uid) {
      try {
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, {
          dashboardPreferences: nextPrefs
        }, { merge: true });
      } catch (err) {
        console.error("Failed to save dashboard preferences:", err);
      }
    }
  };

  const MediaList = ({ title, items, icon, onCardClick, viewAllPath, emptyMessage, onQuickActions, variant = "carousel", loading }) => {
    if ((!items || items.length === 0) && !emptyMessage && !loading) return null;

    return (
      <div className="mb-12">
        <SectionHeader 
          title={title} 
          icon={<span className="material-symbols-outlined">{icon}</span>} 
          actionText={viewAllPath && items && items.length > 0 ? "View All" : undefined}
          onAction={viewAllPath && items && items.length > 0 ? () => navigate(viewAllPath) : undefined}
        />
        {loading ? (
          <Carousel>
            {Array.from({ length: 8 }).map((_, idx) => (
              <div key={idx} className={`flex-none ${variant === 'continue_watching' ? 'w-64 sm:w-72 lg:w-80' : 'w-36 sm:w-44 lg:w-48'} flex flex-col`}>
                <div 
                  className={`w-full aspect-${variant === 'continue_watching' ? 'video' : '[2/3]'} bg-gray-800/60 border border-white/5 animate-pulse rounded-[12px]`} 
                />
                {variant !== 'carousel' && (
                  <div className="mt-2 flex flex-col gap-1.5 px-1 animate-pulse">
                    <div className="h-4 w-3/4 bg-gray-800/60 rounded" />
                    <div className="h-3 w-1/2 bg-gray-800/60 rounded" />
                  </div>
                )}
              </div>
            ))}
          </Carousel>
        ) : items && items.length > 0 ? (
          <Carousel>
            {items.map((media) => {
              if (!media) return null;
              return (
                <MediaCard 
                  key={media.id} 
                  media={media} 
                  variant={variant}
                  onClick={() => {
                    if (onCardClick) {
                      onCardClick(media);
                    } else {
                      const isTV = media.mediaType === 'tv' || media.media_type === 'tv';
                      navigate(isTV ? `/shows/${media.id}` : `/movie/${media.id}`);
                    }
                  }}
                  onQuickActions={onQuickActions}
                />
              );
            })}
          </Carousel>
        ) : (
          <div className="glass-effect rounded-xl p-8 text-center border border-white/5 bg-white/2">
            <p className="text-white/40 font-secondary text-sm">{emptyMessage}</p>
          </div>
        )}
      </div>
    );
  };

  // Statistics Row Component
  const renderStatsRow = () => {
    if (!user) return null;

    const statsData = [
      {
        label: "Watching",
        count: stats?.watchingCount ?? 0,
        icon: "play_circle",
        color: "from-red-500/20 to-red-600/5",
        borderColor: "group-hover:border-red-500/30",
        textColor: "text-red-500",
        path: "/library?status=watching&sort=lastWatched:desc"
      },
      {
        label: "Completed",
        count: stats?.completedCount ?? 0,
        icon: "check_circle",
        color: "from-green-500/20 to-green-600/5",
        borderColor: "group-hover:border-green-500/30",
        textColor: "text-green-500",
        path: "/library?status=completed&sort=imdb:desc"
      },
      {
        label: "Plan to Watch",
        count: stats?.watchlistCount ?? 0,
        icon: "bookmark",
        color: "from-blue-500/20 to-blue-600/5",
        borderColor: "group-hover:border-blue-500/30",
        textColor: "text-blue-500",
        path: "/library?status=plan_to_watch&sort=dateAdded:desc"
      },
      {
        label: "Custom Lists",
        count: customLists.length,
        icon: "playlist_play",
        color: "from-amber-500/20 to-amber-600/5",
        borderColor: "group-hover:border-amber-500/30",
        textColor: "text-amber-500",
        path: "/library"
      }
    ];

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statsData.map((stat, idx) => (
          <button
            key={idx}
            onClick={() => navigate(stat.path)}
            className="group text-left glass-effect p-4 rounded-xl border border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent hover:border-white/20 transition-all duration-300 relative overflow-hidden flex flex-col justify-between h-[100px] hover:scale-[1.02] active:scale-[0.98]"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${stat.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />
            
            <div className="flex justify-between items-center relative z-10 w-full">
              <span className="text-white/60 font-secondary text-sm font-medium tracking-wide">{stat.label}</span>
              <span className={`material-symbols-outlined ${stat.textColor} text-xl opacity-80 group-hover:opacity-100 transition-all`}>
                {stat.icon}
              </span>
            </div>
            
            <div className="flex items-baseline gap-1 relative z-10 mt-2">
              {loading ? (
                <div className="h-8 w-12 bg-white/10 rounded animate-pulse" />
              ) : (
                <span className="text-3xl font-bold font-secondary text-white leading-none">
                  {stat.count}
                </span>
              )}
              <span className="text-xs text-white/30 font-secondary">titles</span>
            </div>

            <div className={`absolute bottom-0 left-0 right-0 h-[2px] bg-white/5 transition-all duration-300 ${stat.borderColor}`} />
          </button>
        ))}
      </div>
    );
  };

  const DashboardPreferencesModal = () => {
    if (!isCustomizeOpen) return null;

    const itemsList = [
      { key: "continueWatching", label: "Continue Watching", desc: "Shows or movies you have in progress." },
      { key: "recentlyAdded", label: "Recently Added", desc: "Your most recently added titles." },
      { key: "recentlyWatched", label: "Recently Watched", desc: "Items you've watched or marked completed." },
      { key: "watchlistPicks", label: "Watchlist Picks", desc: "Top rated titles from your watchlist." }
    ];

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
        <div className="glass-effect rounded-2xl p-6 max-w-md w-full border border-white/10 bg-[#141414]/90 shadow-2xl relative">
          <button
            onClick={() => setIsCustomizeOpen(false)}
            className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <h3 className="text-xl font-bold text-white font-secondary mb-2">
            Customize Dashboard
          </h3>
          <p className="text-sm text-white/60 font-secondary mb-6">
            Toggle visibility of shelves on your Browse page.
          </p>

          <div className="space-y-4 mb-6">
            {itemsList.map((item) => (
              <div 
                key={item.key}
                onClick={() => handleTogglePreference(item.key)}
                className="flex items-start gap-4 p-3 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.05] hover:border-white/10 transition-all cursor-pointer"
              >
                <div className="flex items-center h-5 mt-0.5">
                  <input
                    type="checkbox"
                    checked={preferences[item.key] ?? true}
                    onChange={() => {}} 
                    className="w-4 h-4 rounded border-white/20 bg-transparent text-red-600 focus:ring-red-600 focus:ring-offset-0 cursor-pointer accent-red-600"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-white font-secondary">
                    {item.label}
                  </span>
                  <span className="text-xs text-white/40 font-secondary mt-0.5">
                    {item.desc}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => setIsCustomizeOpen(false)}
              className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-secondary text-sm font-semibold transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen premium-page">
      <Header />
      
      {popularMovies === null ? (
        <HeroSkeleton />
      ) : popularMovies.length > 0 ? (
        <Hero movies={popularMovies.slice(0, 5)} />
      ) : null}
      
      <div className={`w-full px-4 sm:px-8 lg:px-12 pb-8 ${(!popularMovies || popularMovies.length === 0) && popularMovies !== null ? 'pt-24' : ''}`}>
        {user && (
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white font-secondary">
              My Dashboard
            </h2>
            <button
              onClick={() => setIsCustomizeOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-white/80 hover:text-white transition-all text-sm font-secondary group"
            >
              <Settings className="w-4 h-4 text-white/60 group-hover:text-white transition-transform group-hover:rotate-45" />
              Customize
            </button>
          </div>
        )}

        {renderStatsRow()}

        {/* Continue Watching Shelf */}
        {user && !loading && totalLibraryCount === 0 ? (
          <div className="glass-effect rounded-2xl p-8 md:p-12 text-center border border-white/5 bg-gradient-to-br from-white/[0.02] to-transparent mb-12 flex flex-col items-center justify-center relative overflow-hidden group">
            {/* Background glowing/glass effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-red-500/20 to-purple-600/20 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-1000 group-hover:duration-200 pointer-events-none" />
            <div className="relative z-10 max-w-md">
              <span className="material-symbols-outlined text-5xl text-red-500 mb-4 animate-bounce">
                movie_filter
              </span>
              <h3 className="text-2xl font-bold text-white font-secondary mb-3">
                Your Library is Empty
              </h3>
              <p className="text-white/60 font-secondary text-sm mb-6 leading-relaxed">
                Add movies and TV shows to track your progress, build custom lists, and get personalized recommendations.
              </p>
              <button
                onClick={() => navigate("/library")}
                className="px-6 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-secondary text-sm font-semibold transition-all duration-300 transform hover:scale-[1.03] active:scale-[0.98] shadow-lg shadow-red-600/20"
              >
                Go to Library
              </button>
            </div>
          </div>
        ) : (
          user && (
            <>
              {preferences.continueWatching && (
                <MediaList
                  title="Continue Watching"
                  items={continueWatchingItems}
                  icon="play_circle"
                  viewAllPath="/library?status=watching&type=all&sort=lastWatched:desc"
                  emptyMessage="No shows or movies in progress."
                  onQuickActions={handleQuickActions}
                  loading={loading}
                  onCardClick={(media) => {
                    const isTV = media.mediaType === 'tv' || media.media_type === 'tv';
                    navigate(isTV ? `/shows/${media.id}` : `/movie/${media.id}`, {
                      state: { resume: true }
                    });
                  }}
                />
              )}

              {preferences.recentlyAdded && (
                <MediaList
                  title="Recently Added"
                  items={recentlyAddedItems}
                  icon="history"
                  viewAllPath="/library?sort=dateAdded:desc&type=all"
                  emptyMessage="Your recently added items will appear here."
                  onQuickActions={handleQuickActions}
                  loading={loading}
                />
              )}

              {preferences.watchlistPicks && (
                <MediaList
                  title="Watchlist Picks"
                  items={watchlistPicksItems}
                  icon="thumb_up"
                  viewAllPath="/library?status=plan_to_watch&sort=imdb:desc&type=all"
                  emptyMessage="Add titles to your watchlist to see recommendations."
                  onQuickActions={handleQuickActions}
                  loading={loading}
                />
              )}

              <BecauseYouWatched 
                recentlyWatchedItems={recentlyWatchedItems} 
                onQuickActions={handleQuickActions} 
              />

              {preferences.recentlyWatched && (
                <MediaList
                  title="Recently Watched"
                  items={recentlyWatchedItems}
                  icon="visibility"
                  viewAllPath="/library?sort=lastWatched:desc&type=all"
                  emptyMessage="Items you finish watching will appear here."
                  onQuickActions={handleQuickActions}
                  loading={loading}
                />
              )}
            </>
          )
        )}
        
        <MediaShelf
          title="Upcoming Movies"
          type="upcoming"
          mediaType="movie"
          icon="event"
          onQuickActions={handleQuickActions}
        />
        <MediaShelf
          title="Popular Movies"
          type="popular"
          mediaType="movie"
          icon="trending_up"
          onQuickActions={handleQuickActions}
        />
        
        <MediaShelf
          title="Top Rated Movies"
          type="top_rated"
          mediaType="movie"
          icon="star"
          onQuickActions={handleQuickActions}
        />
        <MediaShelf
          title="On The Air TV Shows"
          type="upcoming"
          mediaType="tv"
          icon="live_tv"
          onQuickActions={handleQuickActions}
        />
        
        <MediaShelf
          title="Popular TV Shows"
          type="popular"
          mediaType="tv"
          icon="trending_up"
          onQuickActions={handleQuickActions}
        />
        
        <MediaShelf
          title="Top Rated TV Shows"
          type="top_rated"
          mediaType="tv"
          icon="star"
          onQuickActions={handleQuickActions}
        />
        <MediaShelf
          title="Action"
          type="genre"
          mediaType="movie"
          genreId={28}
          icon="sports_martial_arts"
          onQuickActions={handleQuickActions}
        />
        <MediaShelf
          title="Adventure"
          type="genre"
          mediaType="movie"
          genreId={12}
          icon="explore"
          onQuickActions={handleQuickActions}
        />
        <MediaShelf
          title="Romance"
          type="genre"
          mediaType="movie"
          genreId={10749}
          icon="favorite"
          onQuickActions={handleQuickActions}
        />
        <MediaShelf
          title="Action & Adventure"
          type="genre"
          mediaType="tv"
          genreId={10759}
          icon="sports_martial_arts"
          onQuickActions={handleQuickActions}
        />
        <MediaShelf
          title="Comedy"
          type="genre"
          mediaType="tv"
          genreId={35}
          icon="mood"
          onQuickActions={handleQuickActions}
        />
        <MediaShelf
          title="Romance"
          type="genre"
          mediaType="tv"
          genreId={10749}
          icon="favorite"
          onQuickActions={handleQuickActions}
        />
      </div>
      <DashboardPreferencesModal />
      <QuickActionsModal
        isOpen={quickActionsOpen}
        onClose={() => setQuickActionsOpen(false)}
        media={activeMedia}
        userId={user?.uid}
        onMutation={refetch}
        anchor={quickActionsAnchor}
      />
    </div>
  );
};

export default Browse;
