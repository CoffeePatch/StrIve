import React from "react";
import { useSelector } from "react-redux";
import Header from "../../layout/Header";
import { tmdbAdapter } from "../../../domain/media";
import { MediaCard, MediaPoster, MediaBadges, MediaMetadata } from "../../media/MediaCard";
import { useNavigate } from "react-router-dom";
import usePopularMovies from "../../../hooks/movie/usePopularMovies";
import useTopRatedMovies from "../../../hooks/movie/useTopRatedMovies";
import useUpcomingMovies from "../../../hooks/movie/useUpcomingMovies";
import useMoviesByGenre from "../../../hooks/movie/useMoviesByGenre";

const MoviesPage = () => {
  const movies = useSelector((store) => store.movies);
  const navigate = useNavigate();

  usePopularMovies();
  useTopRatedMovies();
  useUpcomingMovies();

  useMoviesByGenre(28);
  useMoviesByGenre(12);
  useMoviesByGenre(10749);

  const MovieList = ({ title, movies, icon }) => {
    if (!movies || movies.length === 0) return null;

    return (
      <div className="mb-12">
        <div className="mb-6">
          <h2 className="text-white text-2xl lg:text-3xl font-bold font-secondary flex items-center gap-3">
            <span className="material-symbols-outlined text-3xl text-red-600">{icon}</span>
            {title}
          </h2>
        </div>
        <div data-horizontal-scroll="true" className="flex overflow-x-scroll scrollbar-hide gap-4 pb-4">
          {movies.map((movie) => {
            const media = tmdbAdapter(movie);
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
          movies={movies.popularMovies}
          icon="trending_up"
        />
        <MovieList
          title="Top Rated"
          movies={movies.topRatedMovies}
          icon="star"
        />
        <MovieList
          title="Upcoming"
          movies={movies.upcomingMovies}
          icon="event"
        />

        <MovieList
          title="Action"
          movies={movies.genreMovies?.[28]}
          icon="sports_martial_arts"
        />
        <MovieList
          title="Adventure"
          movies={movies.genreMovies?.[12]}
          icon="explore"
        />
        <MovieList
          title="Romance"
          movies={movies.genreMovies?.[10749]}
          icon="favorite"
        />
      </div>
    </div>
  );
};

export default MoviesPage;
