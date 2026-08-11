import React, { useState, useEffect, useLayoutEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { fetchLists } from "../../../util/store/listsSlice";
import Header from "../../layout/Header";
import useMediaDetailsCore from "../../../hooks/media/useMediaDetailsCore";
import CreateListModal from "../../lists/CreateListModal";
import MediaHero from "../../media/MediaDetails/MediaHero";
import MediaRatings from "../../media/MediaDetails/MediaRatings";
import MediaActions from "../../media/MediaDetails/MediaActions";
import MediaGenres from "../../media/MediaDetails/MediaGenres";
import MediaCast from "../../media/MediaDetails/MediaCast";
import MediaTrailers from "../../media/MediaDetails/MediaTrailers";
import SimilarMoviesPanel from "./SimilarMoviesPanel";
import MediaDetailSkeleton from "../../media/MediaDetailSkeleton";
import UserNotesWidget from "../../media/MediaDetails/UserNotesWidget";

const MovieDetails = () => {
  const { movieId, imdbId } = useParams();
  const currentId = imdbId || movieId;
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const {
    user,
    mediaDetails: movieDetails,
    loading: detailsLoading,
    error: detailsError,
    imdbData,
    imdbLoading,
    isWatchlisted,
    isWatched: isCompleted,
    userRating,
    handleRatingChange,
    userNotes,
    handleNotesChange,
    trackingData,
    handleToggleWatchlist,
    handleToggleWatched: handleToggleCompleted,
    mediaItemForLists
  } = useMediaDetailsCore({ mediaId: currentId, mediaType: "movie" });

  const [showCreateModal, setShowCreateModal] = useState(false);

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

  const handlePlayMovie = () => {
    if (!user) {
      alert("Please log in to watch movies.");
      navigate("/login");
      return;
    }
    alert("Playback is not available in the current app. This version focuses on tracking and library management.");
  };

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
            <div className="text-red-500 text-xl mb-4">Error loading Movie</div>
            <p className="text-secondary">{detailsError}</p>
            <button
              onClick={() => navigate("/movies")}
              className="mt-6 px-6 py-3 rounded bg-accent text-inverse hover:bg-accent-hover transition-colors"
            >
              Back to Movies
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!movieDetails) {
    return (
      <div className="min-h-screen premium-page">
        <Header />
        <div className="pt-20 min-h-[calc(100vh-5rem)] flex items-center justify-center">
          <div className="text-center">
            <div className="text-xl mb-4 text-primary">
              Movie not found
            </div>
            <button
              onClick={() => navigate("/movies")}
              className="mt-6 px-6 py-3 rounded bg-accent text-inverse hover:bg-accent-hover transition-colors"
            >
              Back to Movies
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
          backdropPath={movieDetails.backdropPath}
          layoutType="movie"
          posterPath={movieDetails.posterPath}
          logos={movieDetails.images?.logos || movieDetails.logos}
          title={movieDetails.title}
          releaseYear={movieDetails.releaseYear || (movieDetails.releaseDate || "").split("-")[0]}
          durationOrSeasons={movieDetails.runtime ? `${Math.floor(movieDetails.runtime / 60)}h ${movieDetails.runtime % 60}m` : null}
          status={(() => {
            const releaseDate = movieDetails.releaseDate;
            const parsed = releaseDate ? Date.parse(releaseDate) : NaN;
            if (!Number.isFinite(parsed)) return null;
            return parsed > Date.now() ? 'Upcoming' : 'Released';
          })()}
          overview={movieDetails.overview}
          onBack={() => navigate("/movies")}
          ratingsComponent={
            <MediaRatings
              layoutType="movie"
              imdbRating={imdbData?.rating?.aggregateRating || imdbData?.rating?.aggregate_rating || imdbData?.rating?.ratingValue || imdbData?.aggregateRating || imdbData?.aggregate_rating || imdbData?.imdbRating || movieDetails?.imdbRating}
              imdbVotes={imdbData?.rating?.voteCount || imdbData?.rating?.vote_count || imdbData?.rating?.votes_count || imdbData?.rating?.ratingCount || imdbData?.voteCount || imdbData?.vote_count || imdbData?.votes_count || imdbData?.imdbVotes || movieDetails?.imdbVotes}
              imdbLoading={imdbLoading}
              tmdbScore={movieDetails.voteAverage}
              tmdbVotes={movieDetails.voteCount}
              userRating={userRating}
              onRatingChange={handleRatingChange}
            />
          }
          actionsComponent={
            <MediaActions
              layoutType="movie"
              onPlay={handlePlayMovie}
              trailerKey={trailer?.key}
              isWatchlisted={isWatchlisted}
              onToggleWatchlist={handleToggleWatchlist}
              isWatched={isCompleted}
              trackingData={trackingData}
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
        <div className="premium-container pt-10 pb-24 md:pb-10">
          <div className="mx-auto max-w-[1600px]">
            <MediaCast cast={movieDetails.credits?.cast} />
            
            <MediaTrailers videos={movieDetails.videos?.results} />

            <UserNotesWidget notes={userNotes} onSaveNotes={handleNotesChange} />

            <div className="mt-10">
              <SimilarMoviesPanel movieId={currentId} />
            </div>
          </div>
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