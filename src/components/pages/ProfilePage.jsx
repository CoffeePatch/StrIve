import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, Link } from 'react-router-dom';
import { logout } from '../../util/store/userSlice';
import { auth } from '../../util/firebase/firebase';
import { signOut } from 'firebase/auth';
import Header from '../layout/Header';
import { useUserAnalytics } from '../../hooks/user/useUserAnalytics';
import {
  Tv,
  Film,
  Clock,
  Star,
  BarChart3,
  History,
  Settings,
  LogOut,
  Sparkles,
  PieChart,
  CalendarDays,
  Flame,
  RotateCcw
} from 'lucide-react';

const ProfilePage = () => {
  const { user } = useSelector((store) => store.user);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { analytics, loading, error, refetch } = useUserAnalytics(user?.uid);

  const handleLogout = () => {
    signOut(auth).then(() => {
      dispatch(logout());
      navigate('/login');
    });
  };

  const summary = analytics?.summary || {};
  const statusBreakdown = analytics?.statusBreakdown || { completed: 0, watching: 0, plan_to_watch: 0, dropped: 0 };
  const topGenres = analytics?.topGenres || [];
  const ratingHistogram = analytics?.ratingHistogram || [];
  const monthlyActivity = analytics?.monthlyActivity || [];

  const maxMonthlyCount = Math.max(1, ...monthlyActivity.map((m) => m.count));
  const maxGenreCount = Math.max(1, ...topGenres.map((g) => g.count));
  const maxRatingCount = Math.max(1, ...ratingHistogram.map((r) => r.count));

  return (
    <div className="min-h-screen premium-page flex flex-col bg-background text-foreground">
      <Header />

      <main className="flex-grow w-full max-w-[1440px] mx-auto pt-[100px] pb-24 px-4 sm:px-8 space-y-8">
        {/* Profile Hero Header */}
        <div className="glass-effect rounded-3xl p-6 sm:p-8 border border-white/10 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

          <div className="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
            <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-tr from-primary/30 to-primary/10 border border-primary/30 flex items-center justify-center text-primary shadow-lg flex-shrink-0">
                <span className="material-symbols-outlined text-4xl sm:text-5xl">
                  person
                </span>
              </div>
              <div className="space-y-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                  {user?.name || user?.email?.split('@')[0] || 'User Profile'}
                </h1>
                <p className="text-sm text-muted">{user?.email}</p>
                <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-primary/15 text-primary border border-primary/20">
                    <Sparkles className="w-3.5 h-3.5" />
                    Strive Personal Collector
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Header Actions */}
            <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-end">
              <button
                onClick={() => navigate('/history')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface/70 hover:bg-surface text-foreground font-medium border border-white/10 text-sm transition-all shadow-md"
              >
                <History className="w-4 h-4 text-primary" />
                History
              </button>
              <button
                onClick={() => navigate('/settings')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface/70 hover:bg-surface text-foreground font-medium border border-white/10 text-sm transition-all shadow-md"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-error/15 hover:bg-error/25 text-error font-medium border border-error/25 text-sm transition-all shadow-md"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="glass-effect rounded-2xl p-6 border border-white/5 h-32 animate-pulse bg-white/5" />
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="glass-effect rounded-2xl p-6 border border-error/30 bg-error/10 text-error flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={refetch}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error/20 hover:bg-error/30 text-xs font-semibold transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retry
            </button>
          </div>
        )}

        {/* Analytics Dashboard Grid */}
        {!loading && analytics && (
          <div className="space-y-8">
            {/* Top Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              {/* Card 1: Total Watch Time */}
              <div className="glass-effect rounded-2xl p-5 border border-white/10 shadow-lg flex items-center gap-4 relative overflow-hidden">
                <div className="p-3.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/20">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted uppercase tracking-wider">Total Time Spent</p>
                  <h3 className="text-2xl font-bold text-foreground tracking-tight mt-0.5">
                    {summary.totalWatchTimeDays || 0} <span className="text-sm font-semibold text-muted">Days</span>
                  </h3>
                  <p className="text-xs text-muted/80 mt-1">
                    ~{(summary.totalWatchTimeHours || 0).toLocaleString()} hours calculated
                  </p>
                </div>
              </div>

              {/* Card 2: Completed Movies */}
              <div className="glass-effect rounded-2xl p-5 border border-white/10 shadow-lg flex items-center gap-4 relative overflow-hidden">
                <div className="p-3.5 rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/20">
                  <Film className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted uppercase tracking-wider">Movies Tracked</p>
                  <h3 className="text-2xl font-bold text-foreground tracking-tight mt-0.5">
                    {summary.moviesCount || 0}
                  </h3>
                  <p className="text-xs text-muted/80 mt-1">
                    {summary.totalWatchedMovies || 0} completed/watched
                  </p>
                </div>
              </div>

              {/* Card 3: TV Shows & Episodes */}
              <div className="glass-effect rounded-2xl p-5 border border-white/10 shadow-lg flex items-center gap-4 relative overflow-hidden">
                <div className="p-3.5 rounded-xl bg-purple-500/15 text-purple-400 border border-purple-500/20">
                  <Tv className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted uppercase tracking-wider">Episodes Watched</p>
                  <h3 className="text-2xl font-bold text-foreground tracking-tight mt-0.5">
                    {(summary.totalEpisodesWatched || 0).toLocaleString()}
                  </h3>
                  <p className="text-xs text-muted/80 mt-1">
                    Across {summary.tvCount || 0} TV shows
                  </p>
                </div>
              </div>

              {/* Card 4: Mean Personal Rating */}
              <div className="glass-effect rounded-2xl p-5 border border-white/10 shadow-lg flex items-center gap-4 relative overflow-hidden">
                <div className="p-3.5 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                  <Star className="w-6 h-6 fill-emerald-400/30" />
                </div>
                <div>
                  <p className="text-xs font-medium text-muted uppercase tracking-wider">Average Rating</p>
                  <h3 className="text-2xl font-bold text-foreground tracking-tight mt-0.5">
                    {summary.meanUserRating ? `★ ${summary.meanUserRating}` : 'N/A'}
                  </h3>
                  <p className="text-xs text-muted/80 mt-1">
                    {summary.ratedItemsCount || 0} items rated
                  </p>
                </div>
              </div>
            </div>

            {/* Middle Section: Status Breakdown & Monthly Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Library Status Distribution */}
              <div className="lg:col-span-5 glass-effect rounded-2xl p-6 border border-white/10 shadow-xl space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PieChart className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">Library Status</h2>
                  </div>
                  <span className="text-xs font-mono text-muted bg-surface/60 px-2.5 py-1 rounded-full border border-white/10">
                    {summary.totalLibraryItems || 0} Total Items
                  </span>
                </div>

                <div className="space-y-4">
                  {/* Completed */}
                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1.5">
                      <span className="text-foreground/90">Completed</span>
                      <span className="text-muted">{statusBreakdown.completed} items</span>
                    </div>
                    <div className="w-full bg-surface/60 rounded-full h-3 overflow-hidden border border-white/5">
                      <div
                        className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${summary.totalLibraryItems ? (statusBreakdown.completed / summary.totalLibraryItems) * 100 : 0}%`
                        }}
                      />
                    </div>
                  </div>

                  {/* Watching */}
                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1.5">
                      <span className="text-foreground/90">Currently Watching</span>
                      <span className="text-muted">{statusBreakdown.watching} items</span>
                    </div>
                    <div className="w-full bg-surface/60 rounded-full h-3 overflow-hidden border border-white/5">
                      <div
                        className="bg-blue-500 h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${summary.totalLibraryItems ? (statusBreakdown.watching / summary.totalLibraryItems) * 100 : 0}%`
                        }}
                      />
                    </div>
                  </div>

                  {/* Plan to Watch */}
                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1.5">
                      <span className="text-foreground/90">Plan to Watch</span>
                      <span className="text-muted">{statusBreakdown.plan_to_watch} items</span>
                    </div>
                    <div className="w-full bg-surface/60 rounded-full h-3 overflow-hidden border border-white/5">
                      <div
                        className="bg-purple-500 h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${summary.totalLibraryItems ? (statusBreakdown.plan_to_watch / summary.totalLibraryItems) * 100 : 0}%`
                        }}
                      />
                    </div>
                  </div>

                  {/* Dropped */}
                  <div>
                    <div className="flex justify-between text-xs font-medium mb-1.5">
                      <span className="text-foreground/90">Dropped</span>
                      <span className="text-muted">{statusBreakdown.dropped} items</span>
                    </div>
                    <div className="w-full bg-surface/60 rounded-full h-3 overflow-hidden border border-white/5">
                      <div
                        className="bg-rose-500 h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${summary.totalLibraryItems ? (statusBreakdown.dropped / summary.totalLibraryItems) * 100 : 0}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Monthly Watch Velocity Bar Chart */}
              <div className="lg:col-span-7 glass-effect rounded-2xl p-6 border border-white/10 shadow-xl space-y-5 flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-5 h-5 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">Monthly Watch Activity</h2>
                  </div>
                  <span className="text-xs text-muted">Past 6 Months</span>
                </div>

                {monthlyActivity.length === 0 ? (
                  <p className="text-sm text-muted text-center py-8">No monthly activity recorded yet.</p>
                ) : (
                  <div className="grid grid-cols-6 gap-2 sm:gap-4 items-end h-48 pt-6 pb-2">
                    {monthlyActivity.map((m) => {
                      const heightPercent = maxMonthlyCount > 0 ? (m.count / maxMonthlyCount) * 100 : 0;
                      const monthLabel = m.month.split('-')[1];
                      const yearLabel = m.month.split('-')[0].slice(2);

                      return (
                        <div key={m.month} className="flex flex-col items-center gap-2 h-full justify-end group">
                          <span className="text-[11px] font-mono font-medium text-muted group-hover:text-primary transition-colors">
                            {m.count}
                          </span>
                          <div className="w-full bg-surface/60 rounded-t-lg h-36 flex items-end p-1 overflow-hidden">
                            <div
                              className="w-full bg-gradient-to-t from-primary/40 to-primary rounded-t-md transition-all duration-500 group-hover:brightness-125"
                              style={{ height: `${Math.max(6, heightPercent)}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-mono text-muted uppercase">
                            {monthLabel}/{yearLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Section: Top Genres & Rating Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Top Genres */}
              <div className="lg:col-span-6 glass-effect rounded-2xl p-6 border border-white/10 shadow-xl space-y-5">
                <div className="flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-400" />
                  <h2 className="text-lg font-semibold text-foreground">Top Genres</h2>
                </div>

                {topGenres.length === 0 ? (
                  <p className="text-sm text-muted py-6">No genre data available.</p>
                ) : (
                  <div className="space-y-3">
                    {topGenres.map((g) => {
                      const widthPercent = (g.count / maxGenreCount) * 100;
                      return (
                        <div key={g.genre} className="space-y-1">
                          <div className="flex justify-between text-xs font-medium">
                            <span className="text-foreground/90">{g.genre}</span>
                            <span className="text-muted font-mono">{g.count} titles</span>
                          </div>
                          <div className="w-full bg-surface/60 rounded-full h-2.5 overflow-hidden">
                            <div
                              className="bg-amber-400/80 h-full rounded-full transition-all duration-500"
                              style={{ width: `${widthPercent}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Rating Distribution Histogram */}
              <div className="lg:col-span-6 glass-effect rounded-2xl p-6 border border-white/10 shadow-xl space-y-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-emerald-400" />
                    <h2 className="text-lg font-semibold text-foreground">Rating Distribution</h2>
                  </div>
                  <span className="text-xs text-muted">1.0 – 10.0 Scale</span>
                </div>

                {ratingHistogram.length === 0 ? (
                  <p className="text-sm text-muted py-6">No ratings recorded yet.</p>
                ) : (
                  <div className="space-y-2.5 pt-1">
                    {ratingHistogram.map((r) => {
                      const widthPercent = (r.count / maxRatingCount) * 100;
                      return (
                        <div key={r.rating} className="flex items-center gap-3 text-xs">
                          <span className="font-mono font-medium text-emerald-400 w-10 text-right">
                            ★ {r.rating.toFixed(1)}
                          </span>
                          <div className="flex-grow bg-surface/60 rounded-full h-2.5 overflow-hidden">
                            <div
                              className="bg-emerald-500/80 h-full rounded-full transition-all duration-500"
                              style={{ width: `${widthPercent}%` }}
                            />
                          </div>
                          <span className="font-mono text-muted text-[11px] w-8">
                            {r.count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ProfilePage;
