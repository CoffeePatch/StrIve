import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector, useDispatch } from "react-redux";
import { ArrowLeft, Play, Star, AlertTriangle } from "lucide-react";
import Header from "../layout/Header";
import useTvShowDetails from "../../hooks/tv/useTvShowDetails";
import useTvSeasonEpisodes from "../../hooks/tv/useTvSeasonEpisodes";
import useTvVideos from "../../hooks/tv/useTvVideos";
import useRequireAuth from "../../hooks/common/useRequireAuth";
import useImdbTitle from "../../hooks/media/useImdbTitle";
import useLibraryItemStatus from "../../hooks/media/useLibraryItemStatus";
import useEpisodeStates from "../../hooks/tv/useEpisodeStates";
import useMarkEpisodeWatched from "../../hooks/tv/useMarkEpisodeWatched";
import useUnwatchSeries from "../../hooks/tv/useUnwatchSeries";
import SeriesProgressBar from "../media/SeriesProgressBar";
import { fetchLists } from "../../util/store/listsSlice";
import { options } from "../../util/core/constants";
import EpisodeOverlay from "./TVShowDetails/EpisodeOverlay";
import SeasonTabs from "../media/SeasonTabs";
import QuickInfoPanel from "../media/QuickInfoPanel";
import EpisodeViewToggle from "./TVShowDetails/EpisodeViewToggle";
import EpisodeListItem from "./TVShowDetails/EpisodeListItem";
import EpisodeCard from "./TVShowDetails/EpisodeCard";
import SimilarShowsPanel from "./TVShowDetails/SimilarShowsPanel";
import EpisodeMatrixView from "./TVShowDetails/EpisodeMatrixView";
import CreateListModal from "../lists/CreateListModal";
import AddToListPopover from "../lists/AddToListPopover";
import { setLibraryItemStatus, upsertLibraryItem } from "../../util/firebase/firestoreService";

const IMG_CDN_URL = "https://image.tmdb.org/t/p";

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
  const user = useRequireAuth();
  const dispatch = useDispatch();
  const popoverRef = useRef(null);

  const { data: showDetails, loading: detailsLoading, error: detailsError } = useTvShowDetails(tvId);
  const { data: videos } = useTvVideos(tvId);
  const { data: imdbData, loading: imdbLoading, error: imdbError } = useImdbTitle(tvId, "tv");

  const [selectedSeason, setSelectedSeason] = useState(1);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [showEpisodeOverlay, setShowEpisodeOverlay] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [allSeasonsData, setAllSeasonsData] = useState(null);
  const [isLoadingMatrix, setIsLoadingMatrix] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState(null);
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [isWatched, setIsWatched] = useState(false);
  const [showUnwatchModal, setShowUnwatchModal] = useState(false);
  const [toast, setToast] = useState(null);

  const { data: seasonData, loading: episodesLoading } = useTvSeasonEpisodes(
    tvId,
    selectedSeason
  );

  // Episode tracking hooks
  const titleKey = `tmdb_tv_${tvId}`;
  const { watchedSet, markLocallyWatched, clearAllLocal } = useEpisodeStates({ userId: user?.uid, titleKey });
  const { markEpisodeWatched, loading: markWatchedLoading } = useMarkEpisodeWatched();
  const { unwatchSeries, loading: unwatchLoading } = useUnwatchSeries();

  // Fetch library item status from Firestore (hydrate UI state on mount)
  const { isWatchlisted: firestoreIsWatchlisted, isCompleted: firestoreIsWatched } = useLibraryItemStatus({
    userId: user?.uid,
    mediaItem: showDetails ? { id: tvId, media_type: "tv" } : null,
    realtime: true,
  });

  // Sync Firestore library state with local UI state
  useEffect(() => {
    setIsWatchlisted(Boolean(firestoreIsWatchlisted));
    setIsWatched(Boolean(firestoreIsWatched));
  }, [firestoreIsWatchlisted, firestoreIsWatched]);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [tvId]);

  useEffect(() => {
    if (showDetails && showDetails.numberOfSeasons) {
      setSelectedSeason(1);
      if (!allSeasonsData) {
        fetchAllSeasonDetails();
      }
    }
  }, [showDetails]);

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
    } catch (error) {
      console.error("Error fetching all seasons data:", error);
      setAllSeasonsData([]);
    } finally {
      setIsLoadingMatrix(false);
    }
  };

  useEffect(() => {
    if (viewMode === 'matrix' && allSeasonsData === null && showDetails) {
      fetchAllSeasonDetails();
    }
  }, [viewMode, allSeasonsData, showDetails]);

  const trailer = videos?.find(
    (v) => v.site === "YouTube" && v.type === "Trailer" && v.official
  ) || videos?.find((v) => v.site === "YouTube" && v.type === "Trailer");

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

  const mediaItemForLists = showDetails
    ? {
        id: parseInt(tvId),
        name: showDetails.name,
        title: showDetails.name,
        poster_path: showDetails.posterPath || showDetails.poster_path,
        first_air_date: showDetails.firstAirDate || showDetails.first_air_date,
        release_date: showDetails.firstAirDate || showDetails.first_air_date,
        overview: showDetails.overview,
        vote_average: showDetails.voteAverage ?? showDetails.vote_average,
        vote_count: showDetails.voteCount ?? showDetails.vote_count,
        genres: Array.isArray(showDetails.genres) ? showDetails.genres : [],
        number_of_episodes: showDetails.numberOfEpisodes || showDetails.number_of_episodes || null,
        images: {
          tmdbPoster: showDetails.posterPath || showDetails.poster_path || "",
        },
        ratings: {
          tmdbScore: showDetails.voteAverage ?? showDetails.vote_average ?? 0,
          tmdbVotes: showDetails.voteCount ?? showDetails.vote_count ?? 0,
          imdbScore: imdbData?.rating?.aggregateRating || imdbData?.rating?.ratingValue || null,
          imdbVotes: imdbData?.rating?.voteCount || imdbData?.rating?.ratingCount || null,
        },
        imdbRating: imdbData?.rating?.aggregateRating || imdbData?.rating?.ratingValue || null,
        imdbVotes: imdbData?.rating?.voteCount || imdbData?.rating?.ratingCount || null,
        imdbId: imdbData?.id || null,
        media_type: "tv",
      }
    : null;

  // --- Episode watched toggle handler (inline single-click) ---
  const handleToggleEpisodeWatched = useCallback(async (episode) => {
    if (!user) return;
    const sn = Number(episode.seasonNumber ?? episode.season_number);
    const en = Number(episode.episodeNumber ?? episode.episode_number);
    const key = `${sn}:${en}`;

    // If already watched, show unwatch-series confirmation
    if (watchedSet.has(key)) {
      setShowUnwatchModal(true);
      return;
    }

    // Optimistic UI
    markLocallyWatched(sn, en);

    // Ensure we have all seasons loaded so we can build a full catalog for backfilling
    let fullCatalogData = allSeasonsData;
    if (!fullCatalogData || fullCatalogData.length === 0) {
      fullCatalogData = await fetchAllSeasonDetails();
    }

    // If this is the first interaction, ensure the library item is created with metadata
    if (!isWatched && !isWatchlisted) {
      try {
        await upsertLibraryItem(user.uid, mediaItemForLists, { status: "watching" });
        setIsWatched(true);
      } catch (err) {
        console.warn("Failed to upsert library item:", err);
      }
    }

    // Build episode catalog containing all episodes for the callable
    let catalog = [];
    if (fullCatalogData && fullCatalogData.length > 0) {
      catalog = fullCatalogData.flatMap(season => 
        season.episodes?.map(ep => ({
          ...ep,
          seasonNumber: season.season_number,
        })) || []
      ).map((ep, idx) => ({
        seasonNumber: Number(ep.seasonNumber ?? ep.season_number),
        episodeNumber: Number(ep.episodeNumber ?? ep.episode_number),
        absoluteOrder: Number(ep.absoluteOrder) || (Number(ep.seasonNumber ?? ep.season_number) * 1000 + Number(ep.episodeNumber ?? ep.episode_number)) || idx + 1,
        isAired: ep.air_date ? new Date(ep.air_date) <= new Date() : true,
      })).filter((ep) => Number.isInteger(ep.seasonNumber) && Number.isInteger(ep.episodeNumber));
    } else {
      catalog = getAllEpisodes().map((ep, idx) => ({
        seasonNumber: Number(ep.seasonNumber ?? ep.season_number),
        episodeNumber: Number(ep.episodeNumber ?? ep.episode_number),
        absoluteOrder: Number(ep.absoluteOrder) || (Number(ep.seasonNumber ?? ep.season_number) * 1000 + Number(ep.episodeNumber ?? ep.episode_number)) || idx + 1,
        isAired: ep.isAired !== false,
      })).filter((ep) => Number.isInteger(ep.seasonNumber) && Number.isInteger(ep.episodeNumber));
    }

    markEpisodeWatched({ titleKey, seasonNumber: sn, episodeNumber: en, mode: 'backfill_to_episode', episodeCatalog: catalog })
      .then(() => setToast({ type: 'success', message: `✓ S${sn}E${en} and previous marked as watched` }))
      .catch(() => setToast({ type: 'error', message: 'Failed to save watched state' }));
  }, [user, watchedSet, titleKey, markLocallyWatched, markEpisodeWatched, getAllEpisodes, allSeasonsData, fetchAllSeasonDetails, isWatched, isWatchlisted, mediaItemForLists]);

  // --- Unwatch entire series handler ---
  const handleConfirmUnwatch = useCallback(async () => {
    if (!user) return;
    clearAllLocal();
    setShowUnwatchModal(false);
    try {
      await unwatchSeries({ titleKey });
      setToast({ type: 'success', message: '✓ Series progress reset' });
    } catch {
      setToast({ type: 'error', message: 'Failed to reset series progress' });
    }
  }, [user, titleKey, clearAllLocal, unwatchSeries]);

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

  const handleToggleWatchlist = async () => {
    if (!user) {
      alert("Please log in first.");
      return;
    }

    try {
      const newStatus = isWatchlisted ? null : "Plan to Watch";
      await setLibraryItemStatus(user.uid, mediaItemForLists, newStatus);
      setIsWatchlisted(newStatus === "Plan to Watch");
      if (newStatus === "Plan to Watch") setIsWatched(false);
    } catch (error) {
      console.error("Error updating watchlist:", error);
    }
  };

  const handleToggleWatched = async () => {
    if (!user) {
      alert("Please log in first.");
      return;
    }

    try {
      const newStatus = isWatched ? null : "Completed";
      await setLibraryItemStatus(user.uid, mediaItemForLists, newStatus);
      setIsWatched(newStatus === "Completed");
      if (newStatus === "Completed") setIsWatchlisted(false);
    } catch (error) {
      console.error("Error updating watched status:", error);
    }
  };

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
        {/* Hero Section with Backdrop */}
        <div className="relative h-[70vh] bg-cover bg-center"
          style={{
            backgroundImage: showDetails.backdropPath
              ? `url(${IMG_CDN_URL}/original${showDetails.backdropPath})`
              : 'none',
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/40"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/60 to-transparent"></div>

          <button
            onClick={() => navigate("/shows")}
            className="absolute top-6 left-6 z-20 p-3 rounded-full focus-accent transition-all cursor-pointer"
            style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
            aria-label="Back to shows"
          >
            <ArrowLeft className="w-6 h-6" style={{ color: 'var(--color-text-primary)' }} />
          </button>

          <div className="absolute bottom-0 left-0 right-0 p-12 z-10">
            <div className="amoled-container">
              <div className="max-w-4xl">
                {/* Title Logo or Text */}
                {showDetails.logos && showDetails.logos.length > 0 ? (
                  <div className="mb-4">
                    <img
                      src={`${IMG_CDN_URL}/w500${showDetails.logos[0].filePath}`}
                      alt={`${showDetails.name} Logo`}
                      className="max-w-full h-auto max-h-32 object-contain"
                      style={{ maxWidth: '500px' }}
                    />
                  </div>
                ) : (
                  <h1 className="text-5xl md:text-6xl font-bold mb-4 tracking-tight"
                    style={{ color: 'var(--color-text-primary)' }}>
                    {showDetails.name}
                  </h1>
                )}

                {/* Meta Info Row */}
                <div className="flex flex-wrap items-center gap-4 mb-6 text-lg">
                  <span style={{ color: 'var(--color-accent-primary)' }} className="font-semibold">
                    {showDetails.firstAirDate?.split("-")[0]}
                  </span>
                  <span style={{ color: 'var(--color-text-primary)' }}>
                    {showDetails.numberOfSeasons} Season{showDetails.numberOfSeasons !== 1 ? 's' : ''}
                  </span>
                  <span className="px-3 py-1 rounded text-sm font-medium"
                    style={{ backgroundColor: 'var(--color-accent-primary)', color: '#000' }}>
                    {showDetails.status}
                  </span>

                  <div className="flex items-center gap-3">
                    <div className="bg-black/90 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-yellow-500/50 shadow-lg">
                      <span className="text-yellow-400 text-xs font-bold">
                        IMDb
                      </span>
                      {imdbLoading ? (
                        <div className="h-4 w-16 rounded animate-pulse" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}></div>
                      ) : imdbData?.rating?.aggregateRating || imdbData?.rating?.ratingValue ? (
                        <>
                          <span className="text-white text-sm font-bold">
                            {imdbData?.rating?.aggregateRating || imdbData?.rating?.ratingValue}
                          </span>
                          {(() => {
                            const votes = imdbData?.rating?.voteCount || imdbData?.rating?.ratingCount;
                            const formatted = formatCount(votes);
                            return formatted ? (
                              <>
                                <span className="text-white/40 text-xs">•</span>
                                <span className="text-white/70 text-xs">{formatted}</span>
                              </>
                            ) : null;
                          })()}
                        </>
                      ) : (
                        <span className="text-white/40 text-xs">
                          N/A
                        </span>
                      )}
                    </div>

                    <div className="bg-black/90 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-blue-500/40 shadow-lg">
                      <span className="text-blue-400 text-xs font-bold">
                        TMDB
                      </span>
                      {showDetails.voteAverage ? (
                        <>
                          <span className="text-white text-sm font-bold">
                            {showDetails.voteAverage.toFixed(1)}
                          </span>
                          {(() => {
                            const formatted = formatCount(showDetails.voteCount);
                            return formatted ? (
                              <>
                                <span className="text-white/40 text-xs">•</span>
                                <span className="text-white/70 text-xs">{formatted}</span>
                              </>
                            ) : null;
                          })()}
                        </>
                      ) : (
                        <span className="text-white/40 text-xs">
                          N/A
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Overview */}
                <p className="text-lg leading-relaxed mb-6 max-w-3xl"
                  style={{ color: 'var(--color-text-secondary)' }}>
                  {showDetails.overview}
                </p>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-3 lg:gap-4">
                  {(() => {
                    const actionButtonBaseClass =
                      "group inline-flex h-11 w-11 items-center overflow-hidden rounded-full px-3 transition-all duration-300 ease-out focus-accent cursor-pointer";
                    const actionButtonPrimaryClass =
                      `${actionButtonBaseClass} bg-white text-black hover:w-[148px] hover:bg-white hover:px-4`;
                    const actionButtonSecondaryClass =
                      `${actionButtonBaseClass} bg-white/0 text-white/75 hover:w-[140px] hover:bg-white/10 hover:px-4 hover:text-white`;
                    const actionButtonNeutralClass =
                      `${actionButtonBaseClass} bg-white/0 text-white/75 hover:w-[154px] hover:bg-white/10 hover:px-4 hover:text-white`;
                    const watchlistButtonClass = isWatchlisted
                      ? `${actionButtonBaseClass} border border-yellow-400/40 bg-yellow-400/15 text-yellow-200 hover:w-[154px] hover:bg-yellow-400/20 hover:px-4 hover:text-yellow-100`
                      : actionButtonNeutralClass;
                    const watchedButtonClass = isWatched
                      ? `${actionButtonBaseClass} border border-green-400/40 bg-green-400/15 text-green-200 hover:w-[154px] hover:bg-green-400/20 hover:px-4 hover:text-green-100`
                      : actionButtonNeutralClass;
                    const actionButtonLabelClass =
                      "ml-0 max-w-0 overflow-hidden whitespace-nowrap text-sm font-medium opacity-0 transition-all duration-300 ease-out group-hover:ml-2 group-hover:max-w-40 group-hover:opacity-100";

                    return (
                      <>
                  {seasonData?.episodes && seasonData.episodes.length > 0 && (
                    <button
                      onClick={handlePlayNow}
                      className={actionButtonPrimaryClass}
                    >
                      <Play className="w-5 h-5 shrink-0" />
                      <span className={actionButtonLabelClass}>Play Now</span>
                    </button>
                  )}

                  {trailer && (
                    <a
                      href={`https://www.youtube.com/watch?v=${trailer.key}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={actionButtonSecondaryClass}
                    >
                      <span className="material-symbols-outlined text-xl shrink-0 text-current">movie</span>
                      <span className={actionButtonLabelClass}>Trailer</span>
                    </a>
                  )}

                  <button
                    onClick={handleToggleWatchlist}
                    className={watchlistButtonClass}
                    title="Watchlist"
                  >
                    <span className={`material-symbols-outlined text-xl shrink-0 transition-colors ${isWatchlisted ? 'text-yellow-200' : 'text-white/75 group-hover:text-white'}`}>
                      bookmark
                    </span>
                    <span className={actionButtonLabelClass}>Watchlist</span>
                  </button>

                  <button
                    onClick={handleToggleWatched}
                    className={watchedButtonClass}
                    title="Watched"
                  >
                    <span className={`material-symbols-outlined text-xl shrink-0 transition-colors ${isWatched ? 'text-green-200' : 'text-white/75 group-hover:text-white'}`}>
                      check_circle
                    </span>
                    <span className={actionButtonLabelClass}>Watched</span>
                  </button>

                  <div 
                    ref={popoverRef}
                    className="relative"
                    onMouseEnter={() => {
                      if (hoverTimeout) clearTimeout(hoverTimeout);
                      const timeout = setTimeout(() => setShowPopover(true), 500);
                      setHoverTimeout(timeout);
                    }}
                    onMouseLeave={() => {
                      if (hoverTimeout) clearTimeout(hoverTimeout);
                      const timeout = setTimeout(() => setShowPopover(false), 300);
                      setHoverTimeout(timeout);
                    }}
                  >
                    <button
                      className={actionButtonNeutralClass}
                    >
                      <span className="material-symbols-outlined text-xl shrink-0 text-white/75 transition-colors group-hover:text-white">
                        playlist_add
                      </span>
                      <span className={actionButtonLabelClass}>Lists</span>
                    </button>

                    {showPopover && (
                      <div
                        onMouseEnter={() => {
                          if (hoverTimeout) clearTimeout(hoverTimeout);
                        }}
                        onMouseLeave={() => {
                          if (hoverTimeout) clearTimeout(hoverTimeout);
                          const timeout = setTimeout(() => setShowPopover(false), 300);
                          setHoverTimeout(timeout);
                        }}
                      >
                        <AddToListPopover
                          isOpen={showPopover}
                          onCreateNew={handleCreateNew}
                          userId={user?.uid}
                          mediaItem={mediaItemForLists}
                        />
                      </div>
                    )}
                  </div>
                      </>
                    );
                  })()}
                </div>

                {showDetails.genres && showDetails.genres.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-6">
                    {showDetails.genres.map((genre) => (
                      <span
                        key={genre.id}
                        className="px-3 py-1 rounded-full text-sm"
                        style={{
                          backgroundColor: 'var(--color-bg-elevated)',
                          color: 'var(--color-text-secondary)'
                        }}
                      >
                        {genre.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="amoled-container py-12">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-3">
              {showDetails.posterPath && (
                <div className="mb-6 rounded-lg overflow-hidden shadow-2xl">
                  <img
                    src={`${IMG_CDN_URL}/w500${showDetails.posterPath}`}
                    alt={showDetails.name}
                    className="w-full h-auto"
                    loading="lazy"
                  />
                </div>
              )}

              <QuickInfoPanel showDetails={showDetails} />
            </div>

            <div className="lg:col-span-9">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold" style={{ color: 'var(--color-text-primary)' }}>
                  Episodes
                </h2>
                <EpisodeViewToggle viewMode={viewMode} setViewMode={setViewMode} />
              </div>

              {/* Series Progress Bar */}
              {user && (
                <SeriesProgressBar userId={user.uid} titleKey={titleKey} realtime={true} className="mb-6" />
              )}

              {viewMode !== 'matrix' && (
                <SeasonTabs
                  totalSeasons={showDetails.numberOfSeasons}
                  selectedSeason={selectedSeason}
                  onSeasonChange={setSelectedSeason}
                />
              )}

              <div className="mt-6" role="region" aria-label="Episodes">
                {viewMode === 'matrix' && (
                  isLoadingMatrix ? (
                    <div className="flex justify-center py-12">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-4 mx-auto" style={{ borderColor: 'var(--color-accent-primary)' }}></div>
                        <p className="mt-4" style={{ color: 'var(--color-text-secondary)' }}>Loading all season data...</p>
                      </div>
                    </div>
                  ) : allSeasonsData ? (
                    <EpisodeMatrixView
                      seasonsData={allSeasonsData}
                      baseSeasonInfo={showDetails.seasons || []}
                      onEpisodeClick={(episode, seasonNumber) => {
                        setSelectedSeason(seasonNumber);
                        handleEpisodeClick(episode);
                      }}
                    />
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-red-500">Could not load matrix data.</p>
                    </div>
                  )
                )}

                {viewMode !== 'matrix' && episodesLoading && (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-4" style={{ borderColor: 'var(--color-accent-primary)' }}></div>
                  </div>
                )}

                {viewMode !== 'matrix' && !episodesLoading && seasonData?.episodes && seasonData.episodes.length > 0 && (
                  viewMode === 'list' ? (
                    <div className="relative">
                      <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black to-transparent pointer-events-none z-10"></div>
                      <div className="grid grid-cols-1 gap-4 max-h-[850px] overflow-y-auto scrollbar-hide">
                        {seasonData.episodes.map((episode) => (
                          <EpisodeListItem
                            key={episode.id}
                            episode={episode}
                            onClick={() => handleEpisodeClick(episode)}
                            isWatched={watchedSet.has(`${episode.seasonNumber}:${episode.episodeNumber}`)}
                            onToggleWatched={handleToggleEpisodeWatched}
                            watchLoading={markWatchedLoading}
                          />
                        ))}
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black to-transparent pointer-events-none z-10"></div>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black to-transparent pointer-events-none z-10"></div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[850px] overflow-y-auto scrollbar-hide">
                        {seasonData.episodes.map((episode) => (
                          <EpisodeCard
                            key={episode.id}
                            episode={episode}
                            onClick={() => handleEpisodeClick(episode)}
                            isWatched={watchedSet.has(`${episode.seasonNumber}:${episode.episodeNumber}`)}
                            onToggleWatched={handleToggleEpisodeWatched}
                            watchLoading={markWatchedLoading}
                          />
                        ))}
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-black to-transparent pointer-events-none z-10"></div>
                    </div>
                  )
                )}

                {viewMode !== 'matrix' && !episodesLoading && (!seasonData?.episodes || seasonData.episodes.length === 0) && (
                  <div className="text-center py-12">
                    <p style={{ color: 'var(--color-text-secondary)' }}>No episodes available for this season</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6" style={{ color: 'var(--color-text-primary)' }}>
              You might also like
            </h2>
            <SimilarShowsPanel tvId={tvId} />
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
