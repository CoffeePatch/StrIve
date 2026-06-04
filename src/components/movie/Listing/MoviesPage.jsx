import React from "react";
import Header from "../../layout/Header";
import { MediaCard, MediaPoster, MediaBadges, MediaMetadata } from "../../media/MediaCard";
import { useNavigate } from "react-router-dom";
import useUpcomingMedia from "../../../hooks/media/useUpcomingMedia";
import usePopularMedia from "../../../hooks/media/usePopularMedia";
import useTopRatedMedia from "../../../hooks/media/useTopRatedMedia";
import useMediaByGenre from "../../../hooks/media/useMediaByGenre";
const MoviesPage = () => {
  const navigate = useNavigate();

  const popularMovies = usePopularMedia("movie");
  const topRatedMovies = useTopRatedMedia("movie");
  const actionMovies = useMediaByGenre("movie", 28);
  const adventureMovies = useMediaByGenre("movie", 12);
  const romanceMovies = useMediaByGenre("movie", 10749);

  const upcomingMovies = useUpcomingMedia("movie");

  const MovieList = ({ title, mediaItems, icon }) => {
    if (!mediaItems || mediaItems.length === 0) return null;

    return (
      <div className="mb-12">
        <div className="mb-6">
          <h2 className="text-white text-2xl lg:text-3xl font-bold font-secondary flex items-center gap-3">
            <span className="material-symbols-outlined text-3xl text-red-600">{icon}</span>
            {title}
          </h2>
        </div>
        <div data-horizontal-scroll="true" className="flex overflow-x-scroll scrollbar-hide gap-4 pb-4 snap-x snap-mandatory">
          {mediaItems.map((media) => {
            if (!media) return null;
            return (
              <MediaCard
                key={media.id}
                media={media}
                cardSize="compact"
                onClick={() => navigate(`/movie/${media.id}`)}
              >
                <MediaPoster media={media}>
                  <MediaBadges media={media} enableImdb={false} />
                </MediaPoster>
                <MediaMetadata media={media} />
              </MediaCard>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen premium-page pt-20">
      <Header />
      
      <div className="pt-4 pb-12 px-6 lg:px-12">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <span className="material-symbols-outlined text-8xl gradient-accent leading-none">
              movie
            </span>
          </div>
          <h1 className="font-display text-6xl lg:text-7xl font-bold gradient-text mb-6">
            Movies
          </h1>
          <p className="text-xl text-white/60 font-secondary max-w-2xl mx-auto">
            Discover amazing movies from around the world. Watch your favorites
            anytime, anywhere.
          </p>
        </div>
      </div>

      <div className="w-full px-6 lg:px-12 pb-20">
        <MovieList
          title="Popular Movies"
          mediaItems={popularMovies}
          icon="trending_up"
        />
        <MovieList
          title="Top Rated"
          mediaItems={topRatedMovies}
          icon="star"
        />
        <MovieList
          title="Upcoming"
          mediaItems={upcomingMovies}
          icon="event"
        />

        <MovieList
          title="Action"
          mediaItems={actionMovies}
          icon="sports_martial_arts"
        />
        <MovieList
          title="Adventure"
          mediaItems={adventureMovies}
          icon="explore"
        />
        <MovieList
          title="Romance"
          mediaItems={romanceMovies}
          icon="favorite"
        />
      </div>
    </div>
  );
};

export default MoviesPage;
