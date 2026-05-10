import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { options } from "../util/constants";
import { addItem, fetchLists } from "../util/listsSlice";
import { upsertLibraryItemV2 } from "../util/firestoreService";
import Header from "./Header";
import useRequireAuth from "../hooks/useRequireAuth";
import useImdbTitle from "../hooks/useImdbTitle";
import MoviePlayer from "./MoviePlayer";
import AddToListPopover from "./AddToListPopover";
import CreateListModal from "./CreateListModal";

const formatCount = (num) => {
  if (num === null || num === undefined) return 'N/A';
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toString();
};

const MovieDetails = () => {
  const { movieId, imdbId } = useParams();
  const [movieDetails, setMovieDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPlayer, setShowPlayer] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState(null);
  const navigate = useNavigate();
  const user = useRequireAuth();
  const dispatch = useDispatch();
  
  // Get lists from Redux
  const { customLists } = useSelector((state) => state.lists);
  
  const currentId = imdbId || movieId;
  const mediaType = currentId && currentId.startsWith('tt') ? "movie" : "movie";
  const { data: imdbData, loading: imdbLoading } = useImdbTitle(currentId, mediaType);

  const fetchMovieDetails = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://api.themoviedb.org/3/movie/${movieId}?language=en-US&append_to_response=images,credits,similar&include_image_language=en,null`,
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

  useEffect(() => {
    fetchMovieDetails();
  }, [fetchMovieDetails]);

  // Fetch user's lists on mount
  useEffect(() => {
    if (user) {
      dispatch(fetchLists(user.uid));
    }
  }, [dispatch, user]);
  
  // Cleanup hover timeout on unmount
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
    setShowPlayer(true);
  };

  const handleSelectList = async (selection) => {
    if (!user) {
      alert("Please log in to add movies to your lists.");
      setShowPopover(false);
      return;
    }

    try {
      const mediaItem = {
        id: movieDetails.id,
        title: movieDetails.title,
        poster_path: movieDetails.poster_path,
        overview: movieDetails.overview,
        release_date: movieDetails.release_date,
        vote_average: movieDetails.vote_average,
        vote_count: movieDetails.vote_count,
        imdbId: currentId && currentId.startsWith('tt') ? currentId : (imdbData?.id || null),
        imdbRating: imdbData?.rating?.aggregateRating || imdbData?.rating?.ratingValue || null,
        imdbVotes: imdbData?.rating?.voteCount || imdbData?.rating?.ratingCount || null,
        media_type: "movie",
      };

      if (selection?.kind === "system") {
        const status = selection.action === "completed" ? "completed" : "plan_to_watch";
        await upsertLibraryItemV2(user.uid, mediaItem, { status });
        alert(
          selection.action === "completed"
            ? `${mediaItem.title} marked as completed!`
            : `${mediaItem.title} added to watchlist!`
        );
      } else if (selection?.kind === "custom" && selection?.listId) {
        await dispatch(addItem({
          userId: user.uid,
          listId: selection.listId,
          mediaItem,
        })).unwrap();
        await upsertLibraryItemV2(user.uid, mediaItem, { listId: selection.listId, status: null });
        alert(`${mediaItem.title} added to your list!`);
      }
      
      setShowPopover(false);
    } catch (error) {
      console.error("Error adding to list:", error);
      alert("Failed to add to list. Please try again.");
    }
  };

  const handleCreateNew = () => {
    setShowPopover(false);
    setShowCreateModal(true);
  };

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
      
      {/* Hero Section with Backdrop */}
      <div className="relative h-screen">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url(https://image.tmdb.org/t/p/original${movieDetails.backdrop_path})`,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-black/50"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 h-full flex items-end">
          <div className="w-full px-6 lg:px-12 pb-20">
            <div className="max-w-5xl">
              {/* Title Logo or Text */}
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

              {/* Ratings - Professional Display with Votes */}
              <div className="mb-6">
                {/* Multi-source Rating Grid */}
                <div className="grid grid-cols-2 md:grid-cols-2 gap-3 mb-3">
                  {/* TMDB Rating Card */}
                  <div className="glass-effect p-3 rounded-xl text-center border border-white/10">
                    <div className="text-xs text-white/50 uppercase tracking-wider font-secondary mb-1">TMDB Rating</div>
                    <div className="flex items-center justify-center gap-1.5">
                      <span className="material-symbols-outlined text-yellow-400 text-xl">star</span>
                      <span className="text-white font-bold font-secondary text-2xl">
                        {movieDetails.vote_average?.toFixed(1)}
                      </span>
                      <span className="text-white/60 text-sm">/10</span>
                    </div>
                    <div className="text-xs text-white/50 mt-1 font-secondary">
                      {movieDetails.vote_count ? `${formatCount(movieDetails.vote_count)} votes` : 'User Rating'}
                    </div>
                  </div>
                  
                  {/* IMDb Rating Card */}
                  <div className="glass-effect p-3 rounded-xl text-center border border-white/10">
                    <div className="text-xs text-white/50 uppercase tracking-wider font-secondary mb-1">IMDb Rating</div>
                    {imdbLoading ? (
                      <div className="flex items-center justify-center gap-1.5 h-8">
                        <div className="h-6 w-16 bg-white/10 rounded-full animate-pulse"></div>
                      </div>
                    ) : imdbData?.rating?.aggregateRating ? (
                      <>
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="text-yellow-400 font-bold text-xl">⭐</span>
                          <span className="text-white font-bold font-secondary text-2xl">
                            {imdbData.rating.aggregateRating}
                          </span>
                          <span className="text-white/60 text-sm">/10</span>
                        </div>
                        <div className="text-xs text-white/50 mt-1 font-secondary">
                          {imdbData.rating.voteCount ? `${formatCount(imdbData.rating.voteCount)} votes` : 'User Rating'}
                        </div>
                      </>
                    ) : (
                      <div className="text-white/40 text-sm py-2">Not Available</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Meta Info */}
              <div className="flex flex-wrap items-center gap-4 mb-6 text-lg font-secondary">
                <span className="text-white/90 font-semibold">
                  {movieDetails.release_date?.split("-")[0]}
                </span>
                <span className="text-white/40">•</span>
                <span className="text-white/90">
                  {Math.floor(movieDetails.runtime / 60)}h {movieDetails.runtime % 60}m
                </span>
                {movieDetails.status && (
                  <>
                    <span className="text-white/40">•</span>
                    <span className="glass-effect px-3 py-1 rounded-full text-sm text-white/90">
                      {movieDetails.status}
                    </span>
                  </>
                )}
              </div>

              {/* Overview */}
              <p className="text-xl text-white/80 mb-8 leading-relaxed max-w-3xl font-primary">
                {movieDetails.overview}
              </p>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-4 mb-8">
                <button
                  onClick={handlePlayMovie}
                  className="btn-primary text-lg px-8 py-4 flex items-center gap-3"
                >
                  <span className="material-symbols-outlined text-2xl">play_circle</span>
                  <span>Play Now</span>
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
                    className="btn-secondary text-lg px-8 py-4 flex items-center gap-3"
                  >
                    <span className="material-symbols-outlined text-2xl">add</span>
                    <span>Add to List</span>
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
                        onSelectList={handleSelectList}
                        onCreateNew={handleCreateNew}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Genres */}
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

      {/* Additional Info Section */}
      <div className="w-full px-6 lg:px-12 py-16">
        <div className="max-w-7xl mx-auto">
          {/* Cast Section */}
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

          {/* Similar Movies */}
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

      {/* Movie Player Modal */}
      {showPlayer && (
        <MoviePlayer
          movieId={movieId}
          onClose={() => setShowPlayer(false)}
        />
      )}

      {/* Create List Modal */}
      <CreateListModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        userId={user?.uid}
      />
    </div>
  );
};

export default MovieDetails;
