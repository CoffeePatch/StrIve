import React, { useState, useEffect, useRef, useLayoutEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { fetchLists } from "../../../util/store/listsSlice";
import Header from "../../layout/Header";
import useMediaDetailsCore from "../../../hooks/media/useMediaDetailsCore";
import AddToListPopover from "../../lists/AddToListPopover";
import CreateListModal from "../../lists/CreateListModal";
import MediaHero from "../../media/MediaDetails/MediaHero";
import MediaRatings from "../../media/MediaDetails/MediaRatings";
import MediaActions from "../../media/MediaDetails/MediaActions";
import MediaGenres from "../../media/MediaDetails/MediaGenres";
import MediaCast from "../../media/MediaDetails/MediaCast";
import Carousel from "../../ui/Carousel";
import MediaCard from "../../ui/MediaCard";
import SectionHeader from "../../ui/SectionHeader";
import { Star } from "lucide-react";

const MovieDetails = () => {
  const { movieId, imdbId } = useParams();
  const currentId = imdbId || movieId;

  const {
    user,
    mediaDetails: movieDetails,
    loading,
    imdbData,
    imdbLoading,
    isWatchlisted,
    isWatched: isCompleted,
    handleToggleWatchlist,
    handleToggleWatched: handleToggleCompleted,
    mediaItemForLists
  } = useMediaDetailsCore({ mediaId: currentId, mediaType: "movie" });

  const [showPopover, setShowPopover] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [hoverTimeout, setHoverTimeout] = useState(null);
  const castScrollRef = useRef(null);
  const similarScrollRef = useRef(null);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const trailer = movieDetails?.videos?.results?.find(
    (v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official
  ) || movieDetails?.videos?.results?.find(
    (v) => v.site === 'YouTube' && v.type === 'Trailer'
  );

  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [currentId]);

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
            <div className="mt-10">
              <SectionHeader 
                title="Similar Movies" 
                icon={<span className="material-symbols-outlined text-3xl">movie_filter</span>} 
              />
              <Carousel>
                {movieDetails.similar.results.slice(0, 12).map((movie) => (
                  <MediaCard
                    key={movie.id}
                    media={movie}
                    variant="recommendation"
                    onClick={() => navigate(`/movie/${movie.id}`)}
                  />
                ))}
              </Carousel>
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