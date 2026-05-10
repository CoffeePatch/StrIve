import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { options } from "../../../util/constants";
import { addItem, fetchLists } from "../../../util/listsSlice";
import { upsertLibraryItemV2 } from "../../../util/firestoreService";
import Header from "../../layout/Header";
import useRequireAuth from "../../../hooks/common/useRequireAuth";
import useImdbTitle from "../../../hooks/media/useImdbTitle";
import MoviePlayer from "../../movie/Player/MoviePlayer";
import AddToListPopover from "../../lists/AddToListPopover";
import CreateListModal from "../../lists/CreateListModal";
import { Star } from "lucide-react";

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
  const [showPlayer, setShowPlayer] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState(null);
  const castScrollRef = useRef(null);
  const similarScrollRef = useRef(null);
  const navigate = useNavigate();
  const user = useRequireAuth();
  const dispatch = useDispatch();
  
  const { customLists } = useSelector((state) => state.lists);
  
  const currentId = imdbId || movieId;
  const mediaType = currentId && currentId.startsWith('tt') ? "movie" : "movie";
  const { data: imdbData, loading: imdbLoading } = useImdbTitle(currentId, mediaType);

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

              <div className="flex flex-wrap gap-4 mb-8">
                <button
                  onClick={handlePlayMovie}
                  className="flex items-center gap-2 px-8 py-4 rounded font-semibold text-lg transition-all hover:opacity-90 focus-accent cursor-pointer"
                  style={{ backgroundColor: 'var(--color-text-primary)', color: '#000' }}
                >
                  <span className="material-symbols-outlined text-2xl">play_circle</span>
                  <span>Play Now</span>
                </button>

                {trailer && (
                  <a
                    href={`https://www.youtube.com/watch?v=${trailer.key}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-8 py-4 rounded font-semibold text-lg transition-all focus-accent cursor-pointer"
                    style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)' }}
                  >
                    <span className="material-symbols-outlined text-2xl">movie</span>
                    <span>Trailer</span>
                  </a>
                )}

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
                    className="flex items-center gap-2 px-8 py-4 rounded font-semibold text-lg transition-all focus-accent cursor-pointer"
                    style={{ backgroundColor: 'var(--color-bg-elevated)', color: 'var(--color-text-primary)' }}
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

      {showPlayer && (
        <MoviePlayer
          movieId={movieId}
          onClose={() => setShowPlayer(false)}
        />
      )}

      <CreateListModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        userId={user?.uid}
      />
    </div>
  );
};

export default MovieDetails;