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
import MediaHero from "../../media/MediaDetails/MediaHero";
import MediaRatings from "../../media/MediaDetails/MediaRatings";
import MediaActions from "../../media/MediaDetails/MediaActions";
import MediaGenres from "../../media/MediaDetails/MediaGenres";
import MediaCast from "../../media/MediaDetails/MediaCast";
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
      
      <MediaHero
        backdropPath={movieDetails.backdrop_path}
        layoutType="movie"
        logos={movieDetails.images?.logos}
        title={movieDetails.title}
        releaseYear={movieDetails.release_date?.split("-")[0]}
        durationOrSeasons={`${Math.floor(movieDetails.runtime / 60)}h ${movieDetails.runtime % 60}m`}
        status={(() => {
          const releaseDate = movieDetails.release_date;
          const parsed = releaseDate ? Date.parse(releaseDate) : NaN;
          if (!Number.isFinite(parsed)) return null;
          return parsed > Date.now() ? 'Upcoming' : 'Released';
        })()}
        overview={movieDetails.overview}
        ratingsComponent={
          <MediaRatings
            imdbRating={imdbData?.rating?.aggregateRating || imdbData?.rating?.ratingValue}
            imdbVotes={imdbData?.rating?.voteCount || imdbData?.rating?.ratingCount}
            imdbLoading={imdbLoading}
            tmdbScore={movieDetails.vote_average}
            tmdbVotes={movieDetails.vote_count}
          />
        }
        actionsComponent={
          <MediaActions
            onPlay={handlePlayMovie}
            trailerKey={trailer?.key}
            isWatchlisted={isWatchlisted}
            onToggleWatchlist={handleToggleWatchlist}
            isWatched={isCompleted}
            onToggleWatched={handleToggleCompleted}
            userId={user?.uid}
            mediaItem={mediaItemForLists}
            onCreateNewList={handleCreateNew}
          />
        }
        genresComponent={
          <MediaGenres genres={movieDetails.genres} />
        }
      />

      <div className="w-full px-6 lg:px-12 py-16">
        <div className="max-w-7xl mx-auto">
          <MediaCast cast={movieDetails.credits?.cast} />

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