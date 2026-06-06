import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { ArrowLeft, Play, AlertTriangle } from "lucide-react";
import Header from "../layout/Header";
import useMediaDetailsCore from "../../hooks/media/useMediaDetailsCore";
import useTvSeasonEpisodes from "../../hooks/tv/useTvSeasonEpisodes";
import useTvVideos from "../../hooks/tv/useTvVideos";
import SeriesProgressBar from "../media/SeriesProgressBar";
import { fetchLists } from "../../util/store/listsSlice";
import { options } from "../../util/core/constants";
import EpisodeOverlay from "./TVShowDetails/EpisodeOverlay";
import SeasonTabs from "../media/SeasonTabs";
import EpisodeViewToggle from "./TVShowDetails/EpisodeViewToggle";
import EpisodeMatrixView from "./TVShowDetails/EpisodeMatrixView";
import CreateListModal from "../lists/CreateListModal";
import AddToListPopover from "../lists/AddToListPopover";
import MediaHero from "../media/MediaDetails/MediaHero";
import MediaRatings from "../media/MediaDetails/MediaRatings";
import MediaActions from "../media/MediaDetails/MediaActions";
import MediaGenres from "../media/MediaDetails/MediaGenres";
import MediaCast from "../media/MediaDetails/MediaCast";
import MediaTrailers from "../media/MediaDetails/MediaTrailers";
import EpisodeList from "../media/MediaDetails/TV/EpisodeList";
import { useSeriesTracking } from "../../domain/tracking/useSeriesTracking";
import SimilarShowsPanel from "./TVShowDetails/SimilarShowsPanel";
import SectionHeader from "../ui/SectionHeader";

const IMG_CDN_URL = "https://image.tmdb.org/t/p";
const SYNCING_TIMEOUT_MS = 12000;

const formatCount = (num) => {
  if (num === null || num === undefined) return null;
  const value = typeof num === 'number' ? num : Number(num);
  if (!Number.isFinite(value)) return null;
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return `${value}`;
};

const TVShowDetailsPage = () => {
  const { tvId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const popoverRef = useRef(null);
  const recomputeKeyRef = useRef(null);

  const {
    user,
    mediaDetails: showDetails,
    loading: detailsLoading,
    error: detailsError,
    imdbData,
    imdbLoading,
    isWatchlisted,
    isWatched,
    handleToggleWatchlist,
    handleToggleWatched,
    mediaItemForLists
  } = useMediaDetailsCore({ mediaId: tvId, mediaType: "tv" });

  const { data: videos } = useTvVideos(tvId);

  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [showEpisodeOverlay, setShowEpisodeOverlay] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [allSeasonsData, setAllSeasonsData] = useState(null);
  const [isLoadingMatrix, setIsLoadingMatrix] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState(null);
  const [showUnwatchModal, setShowUnwatchModal] = useState(false);
  const [toast, setToast] = useState(null);
  const [showWatchChoiceModal, setShowWatchChoiceModal] = useState(false);
  const [watchChoiceEpisode, setWatchChoiceEpisode] = useState(null);
  const [cast, setCast] = useState([]);

  const { data: seasonData, loading: episodesLoading } = useTvSeasonEpisodes(
    tvId,
    selectedSeason
  );

  const titleKey = `tmdb_tv_${tvId}`;

  const fetchAllSeasonDetails = async () => {
    if (!showDetails || !showDetails.numberOfSeasons) return;

    setIsLoadingMatrix(true);
    try {
      const validSeasons = Array.from(
        { length: showDetails.numberOfSeasons }, 
        (_, i) => i + 1
      );

      const seasonPromises = validSeasons.map((seasonNum) =>
        fetch(
          `https://api.themoviedb.org/3/tv/${tvId}/season/${seasonNum}?language=en-US`,
          options
        ).then(res => res.json())
      );

      const seasonsData = await Promise.all(seasonPromises);
      setAllSeasonsData(seasonsData);
      return seasonsData;
    } catch (error) {
      console.error("Error fetching all seasons data:", error);
      setAllSeasonsData([]);
      return [];
    } finally {
      setIsLoadingMatrix(false);
    }
  };

  // Domain Tracking Hook
  const {
    watchedSet,
    seriesProgress,
    pendingProgress,
    applyWatchMode,
    handleUnwatchSeries,
    markWatchedLoading,
    unwatchLoading,
  } = useSeriesTracking({
    user,
    tvId,
    showDetails,
    allSeasonsData,
    currentSeasonEpisodes: seasonData?.episodes || [],
    fetchAllSeasonDetails,
    mediaItemForLists,
    isWatched,
    isWatchlisted
  });

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [tvId]);

  const autoSelectedRef = useRef(false);

  useEffect(() => {
    if (!showDetails || !showDetails.numberOfSeasons) return;

    // 1. Fetch matrix data if not present
    if (allSeasonsData === null && !isLoadingMatrix) {
      fetchAllSeasonDetails();
    }

    // 2. Intelligent Auto-select Season Tab
    if (!autoSelectedRef.current) {
      let targetSeason = 1;

      if (watchedSet && watchedSet.size > 0) {
        let maxSeason = 1;
        for (const key of watchedSet) {
          const sn = parseInt(key.split(':')[0], 10);
          if (!isNaN(sn) && sn > maxSeason) {
            maxSeason = sn;
          }
        }
        
        targetSeason = maxSeason;

        // If we have full season data, check if they finished this max season
        if (allSeasonsData) {
          const sData = allSeasonsData.find(s => s.season_number === maxSeason);
          if (sData && sData.episodes && sData.episodes.length > 0) {
            const allWatched = sData.episodes.every(ep => 
              watchedSet.has(`${maxSeason}:${ep.episode_number}`)
            );
            // Move to next season if current max is fully watched
            if (allWatched && maxSeason < showDetails.numberOfSeasons) {
              targetSeason = maxSeason + 1;
            }
          }
          autoSelectedRef.current = true; // Lock auto-selection
        }
      } else if (allSeasonsData !== null) {
        // Watched set is empty, and matrix loaded, we can lock to 1
        autoSelectedRef.current = true;
      }

      // Clamp targetSeason to available seasons
      targetSeason = Math.min(targetSeason, showDetails.numberOfSeasons);
      
      setSelectedSeason((prev) => prev !== targetSeason ? targetSeason : prev);
    }
  }, [showDetails, watchedSet, allSeasonsData, isLoadingMatrix]);

  useEffect(() => {
    let isActive = true;

    const fetchCast = async () => {
      if (!tvId) return;

      try {
        const response = await fetch(
          `https://api.themoviedb.org/3/tv/${tvId}/credits?language=en-US`,
          options
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch cast: ${response.status}`);
        }

        const data = await response.json();
        if (!isActive) return;

        const normalizedCast = Array.isArray(data?.cast)
          ? data.cast.filter((person) => person?.name).slice(0, 18)
          : [];

        setCast(normalizedCast);
      } catch (error) {
        if (isActive) {
          console.warn("Failed to fetch cast:", error);
          setCast([]);
        }
      }
    };

    fetchCast();

    return () => {
      isActive = false;
    };
  }, [tvId]);

  useEffect(() => {
    if (viewMode === 'matrix' && allSeasonsData === null && showDetails) {
      fetchAllSeasonDetails();
    }
  }, [viewMode, allSeasonsData, showDetails]);

  const trailer = videos?.find(
    (v) => v.site === "YouTube" && v.type === "Trailer" && v.official
  ) || videos?.find((v) => v.site === "YouTube" && v.type === "Trailer");

  const progressOverride = pendingProgress
    ? {
        watchedEpisodesCount: pendingProgress.watchedCount,
        airedEpisodesCount: pendingProgress.airedCount,
        completionRatioAired:
          pendingProgress.airedCount > 0
            ? pendingProgress.watchedCount / pendingProgress.airedCount
            : 0,
        isSyncing: pendingProgress.isSyncing,
      }
    : null;

  const watchChoiceSeason = watchChoiceEpisode
    ? Number(watchChoiceEpisode.seasonNumber ?? watchChoiceEpisode.season_number)
    : null;
  const watchChoiceNumber = watchChoiceEpisode
    ? Number(watchChoiceEpisode.episodeNumber ?? watchChoiceEpisode.episode_number)
    : null;

  const handlePlayNow = () => {
    if (!seasonData?.episodes || seasonData.episodes.length === 0) return;
    setSelectedEpisode(seasonData.episodes[0]);
    setShowEpisodeOverlay(true);
  };

  const handleEpisodeClick = async (episode) => {
    setSelectedEpisode(episode);
    if (!allSeasonsData && showDetails) {
      await fetchAllSeasonDetails();
    }
    setShowEpisodeOverlay(true);
  };

  const getAllEpisodes = () => {
    if (allSeasonsData && allSeasonsData.length > 0) {
      const allEps = allSeasonsData.flatMap(season => 
        season.episodes?.map(ep => ({
          ...ep,
          seasonNumber: season.season_number,
        })) || []
      );
      return allEps;
    }
    const currentSeasonEps = seasonData?.episodes?.map(ep => ({
      ...ep,
      seasonNumber: selectedSeason,
    })) || [];
    return currentSeasonEps;
  };

  const handleConfirmWatchChoice = useCallback(async (mode) => {
    if (!watchChoiceEpisode) return;
    const ep = watchChoiceEpisode;
    setShowWatchChoiceModal(false);
    setWatchChoiceEpisode(null);
    try {
      await applyWatchMode(ep, mode);
      const sn = Number(ep.seasonNumber ?? ep.season_number);
      const en = Number(ep.episodeNumber ?? ep.episode_number);
      const message = mode === "single"
        ? `✓ S${sn}E${en} marked as watched`
        : `✓ S${sn}E${en} and previous marked as watched`;
      setToast({ type: 'success', message });
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to apply watch mode' });
    }
  }, [applyWatchMode, watchChoiceEpisode]);

  // --- Episode watched toggle handler (requires choice) ---
  const handleToggleEpisodeWatched = useCallback((episode) => {
    if (!user) return;
    const sn = Number(episode.seasonNumber ?? episode.season_number);
    const en = Number(episode.episodeNumber ?? episode.episode_number);
    const key = `${sn}:${en}`;

    if (!Number.isInteger(sn) || !Number.isInteger(en)) {
      setToast({ type: 'error', message: 'Episode metadata is invalid.' });
      return;
    }

    // If already watched, show unwatch-series confirmation
    if (watchedSet.has(key)) {
      setShowUnwatchModal(true);
      return;
    }

    setWatchChoiceEpisode(episode);
    setShowWatchChoiceModal(true);
  }, [user, watchedSet]);

  // --- Unwatch entire series handler ---
  const handleConfirmUnwatch = useCallback(async () => {
    if (!user) return;
    setShowUnwatchModal(false);
    try {
      await handleUnwatchSeries();
      setToast({ type: 'success', message: '✓ Series progress reset' });
    } catch {
      setToast({ type: 'error', message: 'Failed to reset series progress' });
    }
  }, [user, handleUnwatchSeries]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);


  useEffect(() => {
    if (user) {
      dispatch(fetchLists(user.uid));
    }
  }, [dispatch, user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target)) {
        setShowPopover(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (hoverTimeout) clearTimeout(hoverTimeout);
    };
  }, [hoverTimeout]);



  const handleCreateNew = () => {
    setShowPopover(false);
    setShowCreateModal(true);
  };

  if (detailsLoading) {
    return (
      <div className="min-h-screen premium-page">
        <Header />
        <div className="pt-20 min-h-[calc(100vh-5rem)] flex items-center justify-center">
          <div className="text-center">
            <div
              className="animate-spin rounded-full h-16 w-16 border-b-4 mx-auto"
              style={{ borderColor: "var(--color-accent-primary)" }}
            ></div>
            <div className="mt-4 text-lg" style={{ color: "var(--color-text-primary)" }}>
              Loading TV Show...
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (detailsError) {
    return (
      <div className="min-h-screen premium-page">
        <Header />
        <div className="pt-20 min-h-[calc(100vh-5rem)] flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-500 text-xl mb-4">Error loading TV show</div>
            <p style={{ color: "var(--color-text-secondary)" }}>{detailsError}</p>
            <button
              onClick={() => navigate("/shows")}
              className="mt-6 px-6 py-3 rounded"
              style={{ backgroundColor: "var(--color-accent-primary)", color: "#000" }}
            >
              Back to Shows
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!showDetails) {
    return (
      <div className="min-h-screen premium-page">
        <Header />
        <div className="pt-20 min-h-[calc(100vh-5rem)] flex items-center justify-center">
          <div className="text-center">
            <div className="text-xl mb-4" style={{ color: "var(--color-text-primary)" }}>
              Show not found
            </div>
            <button
              onClick={() => navigate("/shows")}
              className="mt-6 px-6 py-3 rounded"
              style={{ backgroundColor: "var(--color-accent-primary)", color: "#000" }}
            >
              Back to Shows
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen premium-page pt-20">
      <Header />
      <div className="amoled-page">
        <MediaHero
          backdropPath={showDetails.backdropPath}
          layoutType="tv"
          posterPath={showDetails.posterPath}
          logos={showDetails.logos}
          title={showDetails.name}
          releaseYear={showDetails.firstAirDate?.split("-")[0]}
          durationOrSeasons={`${showDetails.numberOfSeasons} Season${showDetails.numberOfSeasons !== 1 ? 's' : ''}`}
          status={showDetails.status}
          overview={showDetails.overview}
          onBack={() => navigate("/shows")}
          ratingsComponent={
            <MediaRatings
              layoutType="tv"
              imdbRating={imdbData?.rating?.aggregateRating || imdbData?.rating?.aggregate_rating || imdbData?.rating?.ratingValue || imdbData?.aggregateRating || imdbData?.aggregate_rating || imdbData?.imdbRating}
              imdbVotes={imdbData?.rating?.voteCount || imdbData?.rating?.vote_count || imdbData?.rating?.votes_count || imdbData?.rating?.ratingCount || imdbData?.voteCount || imdbData?.vote_count || imdbData?.votes_count || imdbData?.imdbVotes}
              imdbLoading={imdbLoading}
              tmdbScore={showDetails.voteAverage}
              tmdbVotes={showDetails.voteCount}
            />
          }
          actionsComponent={
            <MediaActions
              layoutType="tv"
              onPlay={seasonData?.episodes && seasonData.episodes.length > 0 ? handlePlayNow : null}
              trailerKey={trailer?.key}
              isWatchlisted={isWatchlisted}
              onToggleWatchlist={handleToggleWatchlist}
              isWatched={isWatched}
              onToggleWatched={handleToggleWatched}
              userId={user?.uid}
              mediaItem={mediaItemForLists}
              onCreateNewList={handleCreateNew}
            />
          }
          genresComponent={
            <MediaGenres genres={showDetails.genres} />
          }
        />
        <div className="premium-container py-10">
          <div className="mx-auto max-w-[1600px]">
          <MediaCast cast={cast} />
          
          <MediaTrailers videos={videos} />

          <div id="episodes-section" className="mt-8 md:mt-12">
              <div className="flex justify-between items-center mb-4 border-b border-[var(--color-border)] pb-3">
                <h2 className="text-[18px] md:text-[20px] font-semibold text-[var(--color-text-primary)] leading-none">
                  Episodes
                </h2>
                <div className="flex items-center gap-4">
                  {viewMode !== 'matrix' && seasonData?.episodes && (
                    <span className="text-[14px] text-[var(--color-text-secondary)] font-normal">
                      {seasonData.episodes.length} Episodes &bull; Season {selectedSeason}
                    </span>
                  )}
                  <EpisodeViewToggle viewMode={viewMode} setViewMode={setViewMode} />
                </div>
              </div>

              {/* Series Progress Bar */}
              {user && (
                <SeriesProgressBar
                  userId={user.uid}
                  titleKey={titleKey}
                  realtime={true}
                  className="mb-6"
                  override={progressOverride}
                />
              )}

              {viewMode !== 'matrix' && (
                <SeasonTabs
                  totalSeasons={showDetails.numberOfSeasons}
                  selectedSeason={selectedSeason}
                  onSeasonChange={setSelectedSeason}
                />
              )}

              <EpisodeList
                viewMode={viewMode}
                isLoadingMatrix={isLoadingMatrix}
                allSeasonsData={allSeasonsData}
                showDetails={showDetails}
                setSelectedSeason={setSelectedSeason}
                handleEpisodeClick={handleEpisodeClick}
                episodesLoading={episodesLoading}
                seasonData={seasonData}
                watchedSet={watchedSet}
                handleToggleEpisodeWatched={handleToggleEpisodeWatched}
                markWatchedLoading={markWatchedLoading}
              />
            </div>
            <div className="mt-10">
              <SimilarShowsPanel tvId={tvId} />
            </div>
        </div>
      </div>
      </div>

      {showEpisodeOverlay && selectedEpisode && (
        <EpisodeOverlay
          episode={selectedEpisode}
          showDetails={showDetails}
          allEpisodes={getAllEpisodes()}
          isWatched={watchedSet.has(`${Number(selectedEpisode?.seasonNumber ?? selectedEpisode?.season_number)}:${Number(selectedEpisode?.episodeNumber ?? selectedEpisode?.episode_number)}`)}
          onWatchedChange={() => {}}
          onClose={() => {
            setShowEpisodeOverlay(false);
            setSelectedEpisode(null);
          }}
        />
      )}

      <CreateListModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        userId={user?.uid}
      />

      {/* Watch Choice Modal */}
      {showWatchChoiceModal && watchChoiceEpisode && (
        <div className="unwatch-modal-overlay" onClick={() => { setShowWatchChoiceModal(false); setWatchChoiceEpisode(null); }}>
          <div className="unwatch-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-green-400">done</span>
              </div>
              <h3 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                Mark Episode Watched
              </h3>
            </div>
            <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              Choose how to mark S{watchChoiceSeason}E{watchChoiceNumber}.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleConfirmWatchChoice('single')}
                disabled={markWatchedLoading}
                className="w-full px-4 py-2.5 rounded-lg font-semibold text-sm bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
              >
                {markWatchedLoading ? 'Saving...' : 'Only This Episode'}
              </button>
              <button
                onClick={() => handleConfirmWatchChoice('backfill_to_episode')}
                disabled={markWatchedLoading}
                className="w-full px-4 py-2.5 rounded-lg font-semibold text-sm bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {markWatchedLoading ? 'Saving...' : 'This + All Previous Aired'}
              </button>
              <button
                onClick={() => { setShowWatchChoiceModal(false); setWatchChoiceEpisode(null); }}
                disabled={markWatchedLoading}
                className="w-full px-4 py-2.5 rounded-lg font-semibold text-sm cursor-pointer transition-colors"
                style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unwatch Series Confirmation Modal */}
      {showUnwatchModal && (
        <div className="unwatch-modal-overlay" onClick={() => setShowUnwatchModal(false)}>
          <div className="unwatch-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                Unwatch Entire Series?
              </h3>
            </div>
            <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              This will reset <strong>all</strong> watched episodes for <strong>{showDetails?.name}</strong>. 
              Your tracking progress will be set to zero and the status will change to <em>Plan to Watch</em>.
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowUnwatchModal(false)}
                disabled={unwatchLoading}
                className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm cursor-pointer transition-colors"
                style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUnwatch}
                disabled={unwatchLoading}
                className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm bg-red-600 text-white cursor-pointer hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {unwatchLoading ? 'Resetting...' : 'Yes, Unwatch All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`episode-toast ${toast.type === 'error' ? 'episode-toast--error' : ''}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default TVShowDetailsPage;
