import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { History, Film, Tv, Calendar, Star, ChevronRight, Clock, ArrowLeft } from 'lucide-react';
import Header from '../layout/Header';
import useWatchHistory from '../../hooks/user/useWatchHistory';
import { POSTER_CDN_URL } from '../../util/core/constants';

function formatActivityDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const daysDiff = Math.floor((now - date) / (1000 * 60 * 60 * 24));

  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';
  if (daysDiff < 7) return 'This Week';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

const ActivityHistoryPage = () => {
  const navigate = useNavigate();
  const { items, hasMore, loading, loadingMore, error, loadMore } = useWatchHistory({ limit: 50 });

  // Group items by relative date section
  const groupedItems = useMemo(() => {
    const groups = {};
    items.forEach((item) => {
      const groupKey = formatActivityDate(item.watchedAt);
      if (!groups[groupKey]) {
        groups[groupKey] = [];
      }
      groups[groupKey].push(item);
    });
    return groups;
  }, [items]);

  const handleItemClick = (item) => {
    if (item.mediaType === 'tv') {
      navigate(`/shows/${item.tmdbId}`);
    } else {
      navigate(`/movie/${item.tmdbId}`);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-primary flex flex-col">
      <Header />
      
      <main className="flex-1 pt-24 pb-16 px-4 md:px-8 max-w-5xl mx-auto w-full">
        {/* Page Title Header */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-full bg-surface/80 hover:bg-white/10 text-secondary hover:text-primary transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <History className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-primary tracking-tight">Watch History</h1>
              <p className="text-xs md:text-sm text-secondary">Your chronological activity feed across movies and TV episodes</p>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Initial Loading Skeleton */}
        {loading && items.length === 0 && (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-20 rounded-xl bg-white/5 animate-pulse border border-white/5" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && items.length === 0 && (
          <div className="text-center py-20 bg-surface/40 backdrop-blur-md rounded-2xl border border-white/10 p-8">
            <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-4 text-muted">
              <Clock className="w-8 h-8" />
            </div>
            <h2 className="text-lg font-bold text-primary mb-1">No Watch History Yet</h2>
            <p className="text-xs text-secondary max-w-md mx-auto mb-6">
              Start watching movies or checking off TV episodes to automatically build your watch history timeline.
            </p>
            <button
              onClick={() => navigate('/browse')}
              className="px-6 py-2.5 rounded-xl bg-accent text-inverse font-bold text-xs hover:bg-accent-hover transition-colors"
            >
              Explore Media
            </button>
          </div>
        )}

        {/* Timeline Feed */}
        {Object.entries(groupedItems).map(([dateGroup, groupItems]) => (
          <div key={dateGroup} className="mb-8">
            <div className="flex items-center gap-2 mb-3 px-1 text-xs font-bold uppercase tracking-wider text-muted">
              <Calendar className="w-3.5 h-3.5 text-amber-400" />
              <span>{dateGroup}</span>
            </div>

            <div className="space-y-2.5">
              {groupItems.map((item) => {
                const posterUrl = item.posterPath
                  ? (item.posterPath.startsWith('http') ? item.posterPath : `${POSTER_CDN_URL}${item.posterPath}`)
                  : null;

                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className="group bg-surface/60 backdrop-blur-md hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl p-3 flex items-center justify-between cursor-pointer transition-all duration-200 shadow-md"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      {/* Poster Thumbnail */}
                      <div className="w-11 h-16 rounded-lg bg-black/40 border border-white/10 overflow-hidden flex-shrink-0 relative">
                        {posterUrl ? (
                          <img src={posterUrl} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-muted">
                            {item.mediaType === 'tv' ? <Tv className="w-5 h-5" /> : <Film className="w-5 h-5" />}
                          </div>
                        )}
                      </div>

                      {/* Content Info */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${
                            item.mediaType === 'tv' ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' : 'bg-purple-500/20 text-purple-400 border-purple-500/40'
                          }`}>
                            {item.mediaType === 'tv' ? 'TV Show' : 'Movie'}
                          </span>
                          <span className="text-xs text-muted font-medium flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(item.watchedAt)}
                          </span>
                        </div>

                        <h3 className="text-sm font-bold text-primary truncate group-hover:text-amber-400 transition-colors">
                          {item.title}
                        </h3>

                        {item.mediaType === 'tv' ? (
                          <p className="text-xs text-secondary truncate">
                            <span className="font-semibold text-amber-400/90">S{item.seasonNumber} E{item.episodeNumber}</span>
                            {item.episodeTitle ? ` — ${item.episodeTitle}` : ''}
                          </p>
                        ) : item.userRating ? (
                          <div className="flex items-center gap-1 text-xs text-amber-400 font-semibold mt-0.5">
                            <Star className="w-3 h-3 fill-amber-400" />
                            <span>Rated {Number(item.userRating).toFixed(1)}/10</span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex items-center text-muted group-hover:text-primary transition-colors pl-2">
                      <ChevronRight className="w-5 h-5" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Load More Button */}
        {hasMore && (
          <div className="text-center pt-4">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-6 py-2.5 rounded-xl bg-surface/80 hover:bg-white/10 border border-white/10 text-xs font-bold text-primary transition-colors disabled:opacity-50"
            >
              {loadingMore ? 'Loading More...' : 'Load More History'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default ActivityHistoryPage;
