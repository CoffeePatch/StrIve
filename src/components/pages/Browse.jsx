import React, { useState, useEffect } from "react";
import useNowPlayingMedia from "../../hooks/media/useNowPlayingMedia";
import useUpcomingMedia from "../../hooks/media/useUpcomingMedia";

import usePopularMedia from "../../hooks/media/usePopularMedia";
import useTopRatedMedia from "../../hooks/media/useTopRatedMedia";
import useMediaByGenre from "../../hooks/media/useMediaByGenre";

import Header from "../layout/Header";
import MainContainer from "../layout/MainContainer";
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

const Browse = () => {
  const navigate = useNavigate();
  const user = useSelector((store) => store.user?.user);
  const {
    continueWatching: continueWatchingItems,
    recentlyAdded: recentlyAddedItems,
    recentlyWatched: recentlyWatchedItems,
    watchlistPicks: watchlistPicksItems,
    stats,
    loading,
    refetch
  } = useBrowseLibraryData(user?.uid);

  const [activeMedia, setActiveMedia] = useState(null);
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);

  const handleQuickActions = (media) => {
    setActiveMedia(media);
    setQuickActionsOpen(true);
  };

  useNowPlayingMedia("movie");
  const upcomingMovies = useUpcomingMedia("movie");
  const onTheAirTVShows = useUpcomingMedia("tv");

  const popularMovies = usePopularMedia("movie");
  const topRatedMovies = useTopRatedMedia("movie");
  const popularTVShows = usePopularMedia("tv");
  const topRatedTVShows = useTopRatedMedia("tv");

  const actionMovies = useMediaByGenre("movie", 28);
  const adventureMovies = useMediaByGenre("movie", 12);
  const romanceMovies = useMediaByGenre("movie", 10749);
  
  const actionAdventureTVShows = useMediaByGenre("tv", 10759);
  const comedyTVShows = useMediaByGenre("tv", 35);
  const romanceTVShows = useMediaByGenre("tv", 10749);
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

  const MediaList = ({ title, items, icon, onCardClick, viewAllPath, emptyMessage, onQuickActions }) => {
    if ((!items || items.length === 0) && !emptyMessage) return null;

    return (
      <div className="mb-12">
        <SectionHeader 
          title={title} 
          icon={<span className="material-symbols-outlined">{icon}</span>} 
          actionText={viewAllPath && items && items.length > 0 ? "View All" : undefined}
          onAction={viewAllPath && items && items.length > 0 ? () => navigate(viewAllPath) : undefined}
        />
        {items && items.length > 0 ? (
          <Carousel>
            {items.map((media) => {
              if (!media) return null;
              return (
                <MediaCard 
                  key={media.id} 
                  media={media} 
                  variant="carousel"
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
      <MainContainer />
      
      <div className="w-full px-6 lg:px-12 py-8">
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
        {user && preferences.continueWatching && (
          <MediaList
            title="Continue Watching"
            items={continueWatchingItems}
            icon="play_circle"
            viewAllPath="/library?status=watching&type=all&sort=lastWatched:desc"
            emptyMessage="No shows or movies in progress."
            onQuickActions={handleQuickActions}
            onCardClick={(media) => {
              const isTV = media.mediaType === 'tv' || media.media_type === 'tv';
              navigate(isTV ? `/shows/${media.id}` : `/movie/${media.id}`, {
                state: { resume: true }
              });
            }}
          />
        )}

        {/* Recently Added Shelf */}
        {user && preferences.recentlyAdded && (
          <MediaList
            title="Recently Added"
            items={recentlyAddedItems}
            icon="history"
            viewAllPath="/library?sort=dateAdded:desc&type=all"
            emptyMessage="Your recently added items will appear here."
            onQuickActions={handleQuickActions}
          />
        )}

        {/* Recently Watched Shelf */}
        {user && preferences.recentlyWatched && (
          <MediaList
            title="Recently Watched"
            items={recentlyWatchedItems}
            icon="visibility"
            viewAllPath="/library?sort=lastWatched:desc&type=all"
            emptyMessage="Items you finish watching will appear here."
            onQuickActions={handleQuickActions}
          />
        )}

        {/* Watchlist Picks Shelf */}
        {user && preferences.watchlistPicks && (
          <MediaList
            title="Watchlist Picks"
            items={watchlistPicksItems}
            icon="thumb_up"
            viewAllPath="/library?status=plan_to_watch&sort=imdb:desc&type=all"
            emptyMessage="Add titles to your watchlist to see recommendations."
            onQuickActions={handleQuickActions}
          />
        )}

        <MediaList
          title="Popular Movies"
          items={popularMovies}
          icon="trending_up"
          onQuickActions={handleQuickActions}
        />
        
        <MediaList
          title="Top Rated Movies"
          items={topRatedMovies}
          icon="star"
          onQuickActions={handleQuickActions}
        />
        
        <MediaList
          title="Upcoming Movies"
          items={upcomingMovies}
          icon="event"
          onQuickActions={handleQuickActions}
        />
        <MediaList
          title="Action"
          items={actionMovies}
          icon="sports_martial_arts"
          onQuickActions={handleQuickActions}
        />
        <MediaList
          title="Adventure"
          items={adventureMovies}
          icon="explore"
          onQuickActions={handleQuickActions}
        />
        <MediaList
          title="Romance"
          items={romanceMovies}
          icon="favorite"
          onQuickActions={handleQuickActions}
        />
        
        <MediaList
          title="On The Air TV Shows"
          items={onTheAirTVShows}
          icon="live_tv"
          onQuickActions={handleQuickActions}
        />
        
        <MediaList
          title="Popular TV Shows"
          items={popularTVShows}
          icon="trending_up"
          onQuickActions={handleQuickActions}
        />
        
        <MediaList
          title="Top Rated TV Shows"
          items={topRatedTVShows}
          icon="star"
          onQuickActions={handleQuickActions}
        />
        <MediaList
          title="Action & Adventure"
          items={actionAdventureTVShows}
          icon="sports_martial_arts"
          onQuickActions={handleQuickActions}
        />
        <MediaList
          title="Comedy"
          items={comedyTVShows}
          icon="mood"
          onQuickActions={handleQuickActions}
        />
        <MediaList
          title="Romance"
          items={romanceTVShows}
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
      />
    </div>
  );
};

export default Browse;
