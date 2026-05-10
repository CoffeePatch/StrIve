import React, { useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { useSimkl, useSimklBackgroundSync } from "../../hooks/simkl/useSimkl";
import { fetchLists, addItemsBatch } from "../../util/listsSlice";
import Header from "../layout/Header";
import Footer from "../layout/Footer";
import { toast } from "react-toastify";
import CreateListModal from "../lists/CreateListModal";
import enrichmentService from "../../services/enrichment/enrichmentService";
import {
  mapSimklMovieToStrive,
  mapSimklShowToStrive,
  mapSimklAnimeToStrive,
} from "../../util/simklMapper";

const SimklPage = () => {
  const dispatch = useDispatch();
  const { isAuthenticated, userProfile, userStats, login, sync, logout } =
    useSimkl();

  // Enable background sync
  useSimklBackgroundSync();

  const { customLists } = useSelector((state) => state.lists);
  const user = useSelector((state) => state.user.user);

  const [selectedListId, setSelectedListId] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [debugOutput, setDebugOutput] = useState(null);
  const [enrichmentProgress, setEnrichmentProgress] = useState(0);

  // Fetch lists on mount and start enrichment
  useEffect(() => {
    if (user?.uid) {
      dispatch(fetchLists(user.uid));
      enrichmentService.startEnrichment(user.uid);

      // Simple polling for progress (since we don't have a real subscription yet)
      // DISABLED: Detaching this feature for now to reduce background processing
      // const interval = setInterval(() => {
      //   if (enrichmentService.isProcessing) {
      //     // We could expose a progress getter in the service, but for now just show "Enriching..."
      //     setEnrichmentProgress((prev) => (prev >= 100 ? 0 : prev + 5));
      //   } else {
      //     setEnrichmentProgress(0);
      //   }
      // }, 1000);

      return () => {
        enrichmentService.stop();
        // clearInterval(interval); // Disabled
      };
    }
  }, [dispatch, user]);

  // Set default selected list if available
  useEffect(() => {
    if (customLists.lists.length > 0 && !selectedListId) {
      // Prefer "Watch Later" or the first list
      const watchLater = customLists.lists.find(
        (l) => l.name === "Watch Later"
      );
      setSelectedListId(watchLater ? watchLater.id : customLists.lists[0].id);
    }
  }, [customLists.lists, selectedListId]);

  const handleSync = async () => {
    if (!selectedListId) {
      toast.error("Please select a list to sync to");
      return;
    }

    setIsSyncing(true);
    try {
      // 1. Fetch data from Simkl (force sync to ensure we get data even if timestamps match)
      const payload = await sync({ force: true }).unwrap();
      console.log("DEBUG: Sync Payload:", payload);
      setDebugOutput(payload); // Show on screen

      if (payload && payload.data) {
        console.log("=== RAW SIMKL RESPONSE ===");
        console.log(JSON.stringify(payload.data, null, 2));
        
        console.log("\n=== FIRST MOVIE EXAMPLE ===");
        if (payload.data.movies && payload.data.movies[0]) {
          console.log(JSON.stringify(payload.data.movies[0], null, 2));
        }
        
        console.log("\n=== FIRST SHOW EXAMPLE ===");
        if (payload.data.shows && payload.data.shows[0]) {
          console.log(JSON.stringify(payload.data.shows[0], null, 2));
        }
        
        console.log("\n=== FIRST ANIME EXAMPLE ===");
        if (payload.data.anime && payload.data.anime[0]) {
          console.log(JSON.stringify(payload.data.anime[0], null, 2));
        }
        
        const { movies = [], shows = [], anime = [] } = payload.data;

        // 2. Map items to Strive format
        const mappedMovies = movies.map((m) => mapSimklMovieToStrive(m));
        const mappedShows = shows.map((s) => mapSimklShowToStrive(s));
        const mappedAnime = anime.map((a) => mapSimklAnimeToStrive(a));

        // Filter out items without an ID to prevent Firestore errors
        const allItems = [
          ...mappedMovies,
          ...mappedShows,
          ...mappedAnime,
        ].filter((item) => item.id);

        if (allItems.length === 0) {
          toast.info("No valid items to sync");
          setIsSyncing(false);
          return;
        }

        // 3. Batch add to selected list
        await dispatch(
          addItemsBatch({
            userId: user.uid,
            listId: selectedListId,
            items: allItems,
          })
        ).unwrap();

        toast.success(`Successfully synced ${allItems.length} items!`);

        // Refresh lists to show new counts
        dispatch(fetchLists(user.uid));

        // Start background enrichment
        enrichmentService.startEnrichment(user.uid);
      } else if (payload && payload.message === "Already up to date") {
        toast.info("Already up to date");
        enrichmentService.startEnrichment(user.uid); // Ensure it runs even if up to date
      }
    } catch (error) {
      console.error("Sync failed:", error);
      // Handle both Error objects and string errors from rejectWithValue
      const errorMessage =
        typeof error === "string" ? error : error.message || "Unknown error";
      toast.error("Sync failed: " + errorMessage);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <Header />

      <main className="flex-grow pt-24 px-4 md:px-10 pb-20">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <img
              src="https://simkl.com/static/img/simkl_logo_text_white.png"
              alt="SIMKL"
              className="h-16 mx-auto mb-6 opacity-90"
            />
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 font-display">
              Sync Your Watch History
            </h1>
            <p className="text-xl text-white/60 max-w-2xl mx-auto font-secondary">
              Connect your Simkl account to automatically import your watched
              movies, TV shows, and anime into your Strive collections.
            </p>
          </div>

          {/* Enrichment Progress Bar */}
          {enrichmentProgress > 0 && (
            <div className="fixed top-20 left-0 w-full z-50 px-4 md:px-10">
              <div className="max-w-4xl mx-auto bg-black/80 backdrop-blur-md rounded-b-xl border border-white/10 p-2 flex items-center gap-4 shadow-2xl">
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider animate-pulse">
                  Enriching Library...
                </span>
                <div className="flex-grow h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500 transition-all duration-500 ease-out"
                    style={{ width: `${enrichmentProgress}%` }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          {!isAuthenticated ? (
            /* Login State */
            <div className="glass-effect rounded-3xl p-10 text-center max-w-lg mx-auto border border-white/10 shadow-2xl">
              <span className="material-symbols-outlined text-6xl text-purple-400 mb-6">
                sync_lock
              </span>
              <h2 className="text-2xl font-bold text-white mb-4">
                Connect to Simkl
              </h2>
              <p className="text-white/60 mb-8">
                Sign in to sync your watch history, ratings, and lists across
                all your devices.
              </p>
              <button
                onClick={login}
                className="w-full py-4 bg-[#282a2d] hover:bg-[#35383c] text-white rounded-xl font-bold text-lg transition-all transform hover:scale-105 flex items-center justify-center gap-3 border border-white/10"
              >
                <img
                  src="https://simkl.com/favicon.ico"
                  alt=""
                  className="w-6 h-6"
                />
                Continue with Simkl
              </button>
            </div>
          ) : (
            /* Connected State */
            <div className="grid gap-8">
              {/* Stats Cards */}
              {userStats && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="glass-effect p-6 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="material-symbols-outlined text-blue-400">
                        movie
                      </span>
                      <h3 className="text-white/80 font-medium">Movies</h3>
                    </div>
                    <p className="text-3xl font-bold text-white">
                      {userStats.movies?.completed?.count || 0}
                    </p>
                    <p className="text-sm text-white/40">Watched</p>
                  </div>
                  <div className="glass-effect p-6 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="material-symbols-outlined text-purple-400">
                        tv
                      </span>
                      <h3 className="text-white/80 font-medium">TV Shows</h3>
                    </div>
                    <p className="text-3xl font-bold text-white">
                      {userStats.tv?.completed?.count || 0}
                    </p>
                    <p className="text-sm text-white/40">Watched</p>
                  </div>
                  <div className="glass-effect p-6 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="material-symbols-outlined text-pink-400">
                        animation
                      </span>
                      <h3 className="text-white/80 font-medium">Anime</h3>
                    </div>
                    <p className="text-3xl font-bold text-white">
                      {userStats.anime?.completed?.count || 0}
                    </p>
                    <p className="text-sm text-white/40">Watched</p>
                  </div>
                </div>
              )}

              {/* Sync Controls */}
              <div className="glass-effect rounded-3xl p-8 border border-white/10">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 to-blue-600 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
                      {userProfile?.user?.name?.[0]?.toUpperCase() || "U"}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">
                        {userProfile?.user?.name || "Simkl User"}
                      </h2>
                      <p className="text-white/60 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-green-500"></span>
                        Connected
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={logout}
                    className="px-6 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/80 hover:text-white transition-colors text-sm font-medium"
                  >
                    Disconnect
                  </button>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-white/80 text-sm font-medium mb-3">
                      Select Target List
                    </label>
                    <div className="flex gap-3">
                      <select
                        value={selectedListId}
                        onChange={(e) => setSelectedListId(e.target.value)}
                        className="flex-grow bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
                      >
                        <option value="" disabled>
                          Choose a list...
                        </option>
                        {customLists.lists.map((list) => (
                          <option key={list.id} value={list.id}>
                            {list.name} ({list.items?.length || 0} items)
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => setIsCreateModalOpen(true)}
                        className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
                        title="Create New List"
                      >
                        <span className="material-symbols-outlined">add</span>
                      </button>
                    </div>
                    <p className="text-white/40 text-xs mt-2">
                      All synced items will be added to this list. Duplicates
                      will be handled automatically.
                    </p>
                  </div>

                  <button
                    onClick={handleSync}
                    disabled={isSyncing || !selectedListId}
                    className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${
                      isSyncing || !selectedListId
                        ? "bg-white/5 text-white/40 cursor-not-allowed"
                        : "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg hover:shadow-purple-500/25"
                    }`}
                  >
                    {isSyncing ? (
                      <>
                        <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                        Syncing Library...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined">sync</span>
                        Sync Now
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Debug Output Area */}
              {debugOutput && (
                <div className="glass-effect rounded-3xl p-8 border border-white/10 mt-8">
                  <h3 className="text-xl font-bold text-white mb-4">
                    Debug Data (Raw API Response)
                  </h3>
                  <p className="text-white/60 mb-4">
                    Please copy the "ratings" section from one of the items
                    below:
                  </p>
                  <div className="bg-black/50 rounded-xl p-4 overflow-auto max-h-96">
                    <pre className="text-xs text-green-400 font-mono whitespace-pre-wrap">
                      {JSON.stringify(
                        debugOutput.data?.movies?.[0] ||
                          debugOutput.data?.shows?.[0] ||
                          debugOutput,
                        null,
                        2
                      )}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />

      <CreateListModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        userId={user?.uid}
      />
    </div>
  );
};

export default SimklPage;
