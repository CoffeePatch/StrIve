import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { options } from "../../../util/core/constants";
import { fetchLists } from "../../../util/store/listsSlice";
import Header from "../../layout/Header";
import useRequireAuth from "../../../hooks/common/useRequireAuth";
import useImdbTitle from "../../../hooks/media/useImdbTitle";
import useLibraryItemStatus from "../../../hooks/media/useLibraryItemStatus";
import AddToListPopover from "../../lists/AddToListPopover";
import CreateListModal from "../../lists/CreateListModal";
import { Star } from "lucide-react";
import { setLibraryItemStatus } from "../../../util/firebase/firestoreService";

const formatCount = (num) => {
  if (num === null || num === undefined) return 'N/A';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
};

const MovieDetails = () => {
  const { movieId, imdbId } = useParams();
  const [movieDetails, setMovieDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPopover, setShowPopover] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState(null);
  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const castScrollRef = useRef(null);
  const similarScrollRef = useRef(null);
  const navigate = useNavigate();
  const user = useRequireAuth();
  const dispatch = useDispatch();
  
  const currentId = imdbId || movieId;
  const mediaType = currentId && currentId.startsWith('tt') ? "movie" : "movie";
  const { data: imdbData, loading: imdbLoading } = useImdbTitle(currentId, mediaType);

  // Fetch library item status from Firestore (hydrate UI state on mount)
  const { isWatchlisted: firestoreIsWatchlisted, isCompleted: firestoreIsCompleted } = useLibraryItemStatus({
    userId: user?.uid,
    mediaItem: movieDetails ? { id: movieDetails.id, media_type: "movie" } : null,
    realtime: true,
  });

  // Sync Firestore library state with local UI state
  useEffect(() => {
    setIsWatchlisted(Boolean(firestoreIsWatchlisted));
    setIsCompleted(Boolean(firestoreIsCompleted));
  }, [firestoreIsWatchlisted, firestoreIsCompleted]);

  const trailer = movieDetails?.videos?.results?.find(
    (v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official
  ) || movieDetails?.videos?.results?.find(
    (v) => v.site === 'YouTube' && v.type === 'Trailer'
  );

  const fetchMovieDetails = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://api.themoviedb.org/3/movie/${movieId}?language=en-US&append_to_response=images,credits,similar,videos&include_image_language=en,null`,
        options
      );
      const movieData = await response.json();
      setMovieDetails(movieData);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching movie details:", error);
      setLoading(false);
    }
  }, [movieId]);

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
    fetchMovieDetails();
  }, [fetchMovieDetails]);

  useEffect(() => {
    if (user) {
      dispatch(fetchLists(user.uid));
    }
  }, [dispatch, user]);
  
  useEffect(() => {
    return () => {
      if (hoverTimeout) clearTimeout(hoverTimeout);
    };
  }, [hoverTimeout]);

  const handlePlayMovie = () => {
    if (!user) {
      alert("Please log in to watch movies.");
      navigate("/login");
      return;
    }
    alert("Playback is not available in the current app. This version focuses on tracking and library management.");
  };

  const handleCreateNew = () => {
    setShowPopover(false);
    setShowCreateModal(true);
  };

  const handleToggleWatchlist = async () => {
    if (!user) {
      alert("Please log in first.");
      return;
    }
    try {
      const newStatus = isWatchlisted ? null : "Plan to Watch";
      await setLibraryItemStatus(user.uid, mediaItemForLists, newStatus);
      setIsWatchlisted(newStatus === "Plan to Watch");
      if (newStatus === "Plan to Watch") {
        setIsCompleted(false);
      }
    } catch (error) {
      console.error("Error updating watchlist:", error);
    }
  };

  const handleToggleCompleted = async () => {
    if (!user) {
      alert("Please log in first.");
      return;
    }
    try {
      const newStatus = isCompleted ? null : "Completed";
      await setLibraryItemStatus(user.uid, mediaItemForLists, newStatus);
      setIsCompleted(newStatus === "Completed");
      if (newStatus === "Completed") {
        setIsWatchlisted(false);
      }
    } catch (error) {
      console.error("Error updating completed status:", error);
    }
  };

  const actionButtonBaseClass =
    "group inline-flex h-11 w-11 items-center overflow-hidden rounded-full px-3 transition-all duration-300 ease-out focus-accent cursor-pointer";

  const actionButtonPrimaryClass =
    `${actionButtonBaseClass} bg-white/0 text-white/75 hover:w-[146px] hover:bg-white hover:px-4 hover:text-black`;

  const actionButtonSecondaryClass =
    `${actionButtonBaseClass} bg-white/0 text-white/75 hover:w-[132px] hover:bg-white/10 hover:px-4 hover:text-white`;

  const actionButtonNeutralClass =
    `${actionButtonBaseClass} bg-white/0 text-white/75 hover:w-[140px] hover:bg-white/10 hover:px-4 hover:text-white`;

  const watchlistButtonClass = isWatchlisted
    ? `${actionButtonBaseClass} border border-yellow-400/40 bg-yellow-400/15 text-yellow-200 hover:w-[140px] hover:bg-yellow-400/20 hover:px-4 hover:text-yellow-100`
    : actionButtonNeutralClass;

  const completedButtonClass = isCompleted
    ? `${actionButtonBaseClass} border border-green-400/40 bg-green-400/15 text-green-200 hover:w-[132px] hover:bg-green-400/20 hover:px-4 hover:text-green-100`
    : actionButtonNeutralClass;

  const actionButtonLabelClass =
    "ml-0 max-w-0 overflow-hidden whitespace-nowrap text-sm font-medium opacity-0 transition-all duration-300 ease-out group-hover:ml-2 group-hover:max-w-40 group-hover:opacity-100";

  const mediaItemForLists = movieDetails
    ? {
        id: movieDetails.id,
        title: movieDetails.title,
        poster_path: movieDetails.poster_path,
        overview: movieDetails.overview,
        release_date: movieDetails.release_date,
        vote_average: movieDetails.vote_average,
        vote_count: movieDetails.vote_count,
        runtime: movieDetails.runtime,
        genres: movieDetails.genres,
        imdbId: currentId && currentId.startsWith('tt') ? currentId : (imdbData?.id || null),
        imdbRating: imdbData?.rating?.aggregateRating || imdbData?.rating?.ratingValue || null,
        imdbVotes: imdbData?.rating?.voteCount || imdbData?.rating?.ratingCount || null,
        media_type: "movie",
      }
    : null;

  if (loading) {
    return (
      <div className="min-h-screen premium-page flex items-center justify-center">
        <Header />
        <div className="text-center mt-20">
          <div className="animate-spin rounded-full h-20 w-20 border-4 border-white/20 border-t-red-600 mx-auto"></div>
          <div className="mt-6 text-white text-lg font-secondary">Loading Movie Details...</div>
        </div>
      </div>
    );
  }

  if (!movieDetails) {
    return (
      <div className="min-h-screen premium-page flex items-center justify-center">
        <Header />
        <div className="text-center mt-20">
          <span className="material-symbols-outlined text-8xl text-white/30 mb-4">
            movie_off
          </span>
          <div className="text-white text-2xl font-display mb-6">Movie not found</div>
          <button
            onClick={() => navigate(-1)}
            className="btn-primary"
          >
            <span className="material-symbols-outlined">arrow_back</span>
            <span>Go Back</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen premium-page pt-20">
      <Header />
      
      <div className="relative h-screen">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(https://image.tmdb.org/t/p/original${movieDetails.backdrop_path})`,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/50"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent"></div>
        </div>

        <div className="relative z-10 h-full flex items-end">
          <div className="w-full px-6 lg:px-12 pb-20">
            <div className="max-w-5xl">
              {movieDetails.images?.logos?.length > 0 ? (
                <div className="mb-6">
                  <img 
                    src={`https://image.tmdb.org/t/p/w500${movieDetails.images.logos[0].file_path}`}
                    alt={`${movieDetails.title} Logo`}
                    className="max-w-full h-auto max-h-40 object-contain drop-shadow-2xl"
                  />
                </div>
              ) : (
                <h1 className="font-display text-6xl lg:text-7xl font-bold text-white mb-6 drop-shadow-2xl">
                  {movieDetails.title}
                </h1>
              )}

              <div className="flex flex-wrap items-center gap-4 mb-6 text-lg font-secondary">
                <span className="text-white/90 font-semibold">
                  {movieDetails.release_date?.split("-")[0]}
                </span>
                <span className="text-white/90">
                  {Math.floor(movieDetails.runtime / 60)}h {movieDetails.runtime % 60}m
                </span>

                {(() => {
                  const releaseDate = movieDetails.release_date;
                  const parsed = releaseDate ? Date.parse(releaseDate) : NaN;
                  if (!Number.isFinite(parsed)) return null;
                  const label = parsed > Date.now() ? 'Upcoming' : 'Released';
                  return (
                    <span className="glass-effect px-3 py-1 rounded-full text-sm text-white/90">
                      {label}
                    </span>
                  );
                })()}

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
                        {imdbData?.rating?.voteCount ? (
                          <>
                            <span className="text-white/40 text-xs">•</span>
                            <span className="text-white/70 text-xs">{formatCount(imdbData.rating.voteCount)}</span>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-xs text-white/40">N/A</span>
                    )}
                  </div>

                  <div className="bg-black/90 backdrop-blur-md px-3 py-1.5 rounded-full flex items-center gap-2 border border-blue-500/40 shadow-lg">
                    <span className="text-blue-400 text-xs font-bold">TMDB</span>
                    {movieDetails.vote_average ? (
                      <>
                        <span className="text-white text-sm font-bold">
                          {movieDetails.vote_average.toFixed(1)}
                        </span>
                        {movieDetails.vote_count ? (
                          <>
                            <span className="text-white/40 text-xs">•</span>
                            <span className="text-white/70 text-xs">{formatCount(movieDetails.vote_count)}</span>
                          </>
                        ) : null}
                      </>
                    ) : (
                      <span className="text-xs text-white/40">N/A</span>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-xl text-white/80 mb-8 leading-relaxed max-w-3xl font-primary">
                {movieDetails.overview}
              </p>

              <div className="flex flex-wrap items-center gap-3 lg:gap-4 mb-8">
                <button
                  onClick={handlePlayMovie}
                  className={actionButtonPrimaryClass}
                >
                  <span className="material-symbols-outlined text-xl shrink-0 text-current">
                    play_circle
                  </span>
                  <span className={actionButtonLabelClass}>Play Now</span>
                </button>

                {trailer && (
                  <a
                    href={`https://www.youtube.com/watch?v=${trailer.key}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={actionButtonSecondaryClass}
                  >
                    <span className="material-symbols-outlined text-xl shrink-0 text-current">
                      movie
                    </span>
                    <span className={actionButtonLabelClass}>Trailer</span>
                  </a>
                )}

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleWatchlist}
                    className={watchlistButtonClass}
                    title="Add to Watchlist"
                  >
                      <span className={`material-symbols-outlined text-xl shrink-0 transition-colors ${isWatchlisted ? 'text-yellow-200' : 'text-white/75 group-hover:text-white'}`}>
                      bookmark
                    </span>
                    <span className={actionButtonLabelClass}>Watchlist</span>
                  </button>
                  
                  <button
                    onClick={handleToggleCompleted}
                      className={completedButtonClass}
                    title="Mark as Completed"
                  >
                      <span className={`material-symbols-outlined text-xl shrink-0 transition-colors ${isCompleted ? 'text-green-200' : 'text-white/75 group-hover:text-white'}`}>
                      check_circle
                    </span>
                    <span className={actionButtonLabelClass}>Watched</span>
                  </button>

                  <div 
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
                      title="Add to List"
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
                </div>
              </div>

              {movieDetails.genres && (
                <div className="flex flex-wrap gap-3">
                  {movieDetails.genres.map((genre) => (
                    <span
                      key={genre.id}
                      className="glass-effect px-4 py-2 rounded-full text-white/80 text-sm font-secondary"
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

      <div className="w-full px-6 lg:px-12 py-16">
        <div className="max-w-7xl mx-auto">
          {movieDetails.credits?.cast && movieDetails.credits.cast.length > 0 && (
            <div className="mb-16">
              <h2 className="text-3xl font-bold font-display text-white mb-8 flex items-center gap-3">
                <span className="material-symbols-outlined text-4xl text-red-600">group</span>
                Cast
              </h2>
              <div className="flex overflow-x-scroll scrollbar-hide gap-4 pb-4">
                {movieDetails.credits.cast.slice(0, 10).map((person) => (
                  <div key={person.id} className="flex-none w-40">
                    <div className="premium-card overflow-hidden">
                      {person.profile_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w185${person.profile_path}`}
                          alt={person.name}
                          className="w-full h-52 object-cover"
                        />
                      ) : (
                        <div className="w-full h-52 bg-white/5 flex items-center justify-center">
                          <span className="material-symbols-outlined text-5xl text-white/20">
                            person
                          </span>
                        </div>
                      )}
                      <div className="p-3">
                        <p className="text-white font-semibold text-sm truncate font-secondary">
                          {person.name}
                        </p>
                        <p className="text-white/60 text-xs truncate">
                          {person.character}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {movieDetails.similar?.results && movieDetails.similar.results.length > 0 && (
            <div>
              <h2 className="text-3xl font-bold font-display text-white mb-8 flex items-center gap-3">
                <span className="material-symbols-outlined text-4xl text-red-600">movie_filter</span>
                Similar Movies
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                {movieDetails.similar.results.slice(0, 12).map((movie) => (
                  movie.poster_path && (
                    <div
                      key={movie.id}
                      onClick={() => navigate(`/movie/${movie.id}`)}
                      className="cursor-pointer group"
                    >
                      <div className="premium-card overflow-hidden">
                        <img
                          src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`}
                          alt={movie.title}
                          className="w-full h-72 object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="p-3">
                          <p className="text-white font-semibold text-sm truncate font-secondary">
                            {movie.title}
                          </p>
                          <p className="text-white/60 text-xs">
                            {movie.release_date?.split("-")[0]}
                          </p>
                        </div>
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <CreateListModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        userId={user?.uid}
      />
    </div>
  );
};

export default MovieDetails;