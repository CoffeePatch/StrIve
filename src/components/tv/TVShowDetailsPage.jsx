import React, { useState, useEffect, useLayoutEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useDispatch } from "react-redux";
import { ArrowLeft, Play, AlertTriangle } from "lucide-react";
import Header from "../layout/Header";
import useMediaDetailsCore from "../../hooks/media/useMediaDetailsCore";
import useTvSeasonEpisodes from "../../hooks/tv/useTvSeasonEpisodes";
import useTvVideos from "../../hooks/tv/useTvVideos";
import useAutoSeasonSelection from "../../hooks/tv/useAutoSeasonSelection";
import SeriesProgressBar from "../media/SeriesProgressBar";
import { fetchLists } from "../../util/store/listsSlice";
import tmdbApiService from "../../services/tmdb/tmdbApiService";
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
import MediaDetailSkeleton from "../media/MediaDetailSkeleton";
import UserNotesWidget from "../media/MediaDetails/UserNotesWidget";

const IMG_CDN_URL = "https://image.tmdb.org/t/p";
const SYNCING_TIMEOUT_MS = 12000;

const TVShowDetailsPage = () => {
  const { tvId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();

  const {
    user,
    mediaDetails: showDetails,
    loading: detailsLoading,
    error: detailsError,
    imdbData,
    imdbLoading,
    isWatchlisted,
    isWatched,
    userRating,
    handleRatingChange,
    userNotes,
    handleNotesChange,
    trackingData,
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
  const [showCreateModal, setShowCreateModal] = useState(false);
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

  const fetchAllSeasonDetails = useCallback(async () => {
    if (!showDetails || !showDetails.numberOfSeasons) return;

    setIsLoadingMatrix(true);
    try {
      const validSeasons = Array.from(
        { length: showDetails.numberOfSeasons }, 
        (_, i) => i + 1
      );

      const seasonsData = [];
      const batchSize = 5;

      for (let i = 0; i < validSeasons.length; i += batchSize) {
        const batch = validSeasons.slice(i, i + batchSize);
        const batchPromises = batch.map((seasonNum) =>
          fetch(`/api/tv/episodes?tvId=${tvId}&season=${seasonNum}`)
            .then(res => {
              if (!res.ok) throw new Error(`Failed to fetch season ${seasonNum}`);
              return res.json();
            })
            .then(data => ({
              ...data,
              season_number: data.seasonNumber, // Normalize to snake_case for backward compatibility
            }))
        );

        const batchResults = await Promise.all(batchPromises);
        seasonsData.push(...batchResults);
        
        // Update state progressively so matrix updates column-by-column
        setAllSeasonsData([...seasonsData]);
      }
      
      return seasonsData;
    } catch (error) {
      console.error("Error fetching all seasons data:", error);
      return [];
    } finally {
      setIsLoadingMatrix(false);
    }
  }, [showDetails, tvId]);

  // Domain Tracking Hook
  const {
    watchedSet,
    watchedSetLoading,
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
    isWatchlisted,
    onError: (msg) => setToast({ type: 'error', message: msg })
  });

  const handleToggleWatchedClick = async (options = {}) => {
    if (!isWatched) {
      // Mark all episodes watched
      try {
        await applyWatchMode({}, "all");
      } catch (err) {
        console.error("Failed to mark all episodes watched:", err);
      }
    } else if (isWatched && !options.watchedAt) {
      // Unwatch all episodes
      try {
        await handleUnwatchSeries();
      } catch (err) {
        console.error("Failed to unwatch series:", err);
      }
    }
    await handleToggleWatched(options);
  };

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [tvId]);

  const { isAutoSelected, resetAutoSelection, lockAutoSelection } = useAutoSeasonSelection({
    showDetails,
    watchedSet,
    watchedSetLoading,
    setSelectedSeason,
  });

  const changeSeason = useCallback((season) => {
    setSelectedSeason(season);
    lockAutoSelection();
  }, [lockAutoSelection]);

  // Reset auto selection lock if TV ID changes
  useEffect(() => {
    resetAutoSelection();
  }, [tvId]);

  useEffect(() => {
    let isActive = true;

    const fetchCast = async () => {
      if (!tvId) return;

      try {
        const data = await tmdbApiService.get(`/tv/${tvId}/credits`, { language: 'en-US' });

        if (!data) {
          throw new Error('Failed to fetch cast');
        }

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
  }, [viewMode, allSeasonsData, showDetails, fetchAllSeasonDetails]);

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

    // Find the next episode to watch
    const nextToWatch = showDetails?.tvProgress?.nextToWatch || null;
    let targetEpisode = null;

    if (nextToWatch) {
      const targetSeason = Number(nextToWatch.seasonNumber);
      const targetEpisodeNum = Number(nextToWatch.episodeNumber);

      if (selectedSeason === targetSeason) {
        targetEpisode = seasonData.episodes.find(
          (ep) => Number(ep.episodeNumber ?? ep.episode_number) === targetEpisodeNum
        );
      }
    }

    // Fallback 1: First unwatched episode in current season
    if (!targetEpisode) {
      targetEpisode = seasonData.episodes.find((ep) => {
        const epNum = Number(ep.episodeNumber ?? ep.episode_number);
        const key = `${selectedSeason}:${epNum}`;
        return !watchedSet.has(key);
      });
    }

    // Fallback 2: First episode of current season
    if (!targetEpisode) {
      targetEpisode = seasonData.episodes[0];
    }

    if (targetEpisode) {
      setSelectedEpisode(targetEpisode);
      setShowEpisodeOverlay(true);
    }
  };

  // Handle auto-resume behavior on mount
  useEffect(() => {
    if (
      location.state?.resume &&
      showDetails &&
      isAutoSelected &&
      !episodesLoading &&
      seasonData?.episodes?.length > 0 &&
      Number(seasonData.seasonNumber) === Number(selectedSeason)
    ) {
      // Find the next episode to watch
      const nextToWatch = showDetails?.tvProgress?.nextToWatch || null;
      let targetEpisode = null;

      if (nextToWatch) {
        const targetSeason = Number(nextToWatch.seasonNumber);
        const targetEpisodeNum = Number(nextToWatch.episodeNumber);

        // Verify if the active season matches the target season
        if (selectedSeason === targetSeason) {
          targetEpisode = seasonData.episodes.find(
            (ep) => Number(ep.episodeNumber ?? ep.episode_number) === targetEpisodeNum
          );
        } else {
          // If the selected season is not the target season yet, switch to it
          setSelectedSeason(targetSeason);
          return;
        }
      }

      // Fallback 1: Find the first unwatched episode in the current season
      if (!targetEpisode) {
        targetEpisode = seasonData.episodes.find((ep) => {
          const epNum = Number(ep.episodeNumber ?? ep.episode_number);
          const key = `${selectedSeason}:${epNum}`;
          return !watchedSet.has(key);
        });
      }

      // Fallback 2: Default to the first episode of the current season
      if (!targetEpisode && seasonData.episodes.length > 0) {
        targetEpisode = seasonData.episodes[0];
      }

      if (targetEpisode) {
        setSelectedEpisode(targetEpisode);
        setShowEpisodeOverlay(true);
      }

      // Clear route state to prevent re-trigger on refresh or back navigation
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [
    location.state,
    showDetails,
    isAutoSelected,
    episodesLoading,
    seasonData,
    selectedSeason,
    watchedSet,
    navigate,
    location.pathname
  ]);

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

  const handleCreateNew = () => {
    setShowCreateModal(true);
  };

  if (detailsLoading) {
    return <MediaDetailSkeleton />;
  }

  if (detailsError) {
    return (
      <div className="min-h-screen premium-page">
        <Header />
        <div className="pt-20 min-h-[calc(100vh-5rem)] flex items-center justify-center">
          <div className="text-center">
            <div className="text-red-500 text-xl mb-4">Error loading TV show</div>
            <p className="text-secondary">{detailsError}</p>
            <button
              onClick={() => navigate("/shows")}
              className="mt-6 px-6 py-3 rounded bg-accent text-inverse hover:bg-accent-hover transition-colors"
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
            <div className="text-xl mb-4 text-primary">
              Show not found
            </div>
            <button
              onClick={() => navigate("/shows")}
              className="mt-6 px-6 py-3 rounded bg-accent text-inverse hover:bg-accent-hover transition-colors"
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
      <div className="w-full">
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
              imdbRating={imdbData?.rating?.aggregateRating || imdbData?.rating?.aggregate_rating || imdbData?.rating?.ratingValue || imdbData?.aggregateRating || imdbData?.aggregate_rating || imdbData?.imdbRating || showDetails?.imdbRating}
              imdbVotes={imdbData?.rating?.voteCount || imdbData?.rating?.vote_count || imdbData?.rating?.votes_count || imdbData?.rating?.ratingCount || imdbData?.voteCount || imdbData?.vote_count || imdbData?.votes_count || imdbData?.imdbVotes || showDetails?.imdbVotes}
              imdbLoading={imdbLoading}
              tmdbScore={showDetails.voteAverage ?? showDetails.vote_average}
              tmdbVotes={showDetails.voteCount ?? showDetails.vote_count}
              userRating={userRating}
              onRatingChange={handleRatingChange}
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
              trackingData={trackingData}
              onToggleWatched={handleToggleWatchedClick}
              userId={user?.uid}
              mediaItem={mediaItemForLists}
              onCreateNewList={handleCreateNew}
            />
          }
          genresComponent={
            <MediaGenres genres={showDetails.genres} />
          }
        />
        <div className="premium-container pt-10 pb-24 md:pb-10">
          <div className="mx-auto max-w-[1600px]">
          <MediaCast cast={cast} />
          
          <MediaTrailers videos={videos} />

          <div id="episodes-section" className="mt-8 md:mt-12">
              <div className="flex justify-between items-center mb-4 border-b border-border pb-3">
                <h2 className="text-[18px] md:text-[20px] font-semibold text-primary leading-none">
                  Episodes
                </h2>
                <div className="flex items-center gap-4">
                  {viewMode !== 'matrix' && seasonData?.episodes && (
                    <span className="text-[14px] text-secondary font-normal">
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
                  onSeasonChange={changeSeason}
                />
              )}

              <EpisodeList
                viewMode={viewMode}
                isLoadingMatrix={isLoadingMatrix}
                allSeasonsData={allSeasonsData}
                showDetails={showDetails}
                setSelectedSeason={changeSeason}
                handleEpisodeClick={handleEpisodeClick}
                episodesLoading={episodesLoading}
                seasonData={seasonData}
                watchedSet={watchedSet}
                handleToggleEpisodeWatched={handleToggleEpisodeWatched}
                markWatchedLoading={markWatchedLoading}
              />
            </div>
            <UserNotesWidget notes={userNotes} onSaveNotes={handleNotesChange} />
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
          applyWatchMode={applyWatchMode}
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
              <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-success">done</span>
              </div>
              <h3 className="text-xl font-bold text-primary">
                Mark Episode Watched
              </h3>
            </div>
            <p className="text-sm mb-6 leading-relaxed text-secondary">
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
                className="w-full px-4 py-2.5 rounded-lg font-semibold text-sm cursor-pointer transition-colors bg-surface text-primary border border-border hover:bg-surface-hover"
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
              <div className="w-10 h-10 rounded-full bg-error/20 flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-error" />
              </div>
              <h3 className="text-xl font-bold text-primary">
                Unwatch Entire Series?
              </h3>
            </div>
            <p className="text-sm mb-6 leading-relaxed text-secondary">
              This will reset <strong>all</strong> watched episodes for <strong>{showDetails?.name}</strong>. 
              Your tracking progress will be set to zero and the status will change to <em>Plan to Watch</em>.
              This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowUnwatchModal(false)}
                disabled={unwatchLoading}
                className="flex-1 px-4 py-2.5 rounded-lg font-semibold text-sm cursor-pointer transition-colors bg-surface text-primary border border-border hover:bg-surface-hover"
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
