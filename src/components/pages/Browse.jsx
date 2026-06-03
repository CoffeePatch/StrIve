import useAddMovies from "../../hooks/movie/useAddMovies";
import usePopularMovies from "../../hooks/movie/usePopularMovies";
import useTopRatedMovies from "../../hooks/movie/useTopRatedMovies";
import useUpcomingMovies from "../../hooks/movie/useUpcomingMovies";
import usePopularTVShows from "../../hooks/tv/usePopularTVShows";
import useTopRatedTVShows from "../../hooks/tv/useTopRatedTVShows";
import useOnTheAirTVShows from "../../hooks/tv/useOnTheAirTVShows";
import useMoviesByGenre from "../../hooks/movie/useMoviesByGenre";
import useTVShowsByGenre from "../../hooks/tv/useTVShowsByGenre";
import Header from "../layout/Header";
import MainContainer from "../layout/MainContainer";
import { tmdbAdapter } from "../../domain/media";
import { MediaCard, MediaPoster, MediaBadges, MediaMetadata } from "../media/MediaCard";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";

const Browse = () => {
  const navigate = useNavigate();
  useAddMovies();
  usePopularMovies();
  useTopRatedMovies();
  useUpcomingMovies();
  usePopularTVShows();
  useTopRatedTVShows();
  useOnTheAirTVShows();

  // Fetch a few genre rows for the browse/home page
  useMoviesByGenre(28); // Action
  useMoviesByGenre(12); // Adventure
  useMoviesByGenre(10749); // Romance
  useTVShowsByGenre(10759); // Action & Adventure
  useTVShowsByGenre(35); // Comedy
  useTVShowsByGenre(10749); // Romance

  const movies = useSelector((store) => store.movies);
  const tvShows = useSelector((store) => store.tvShows);

  const MediaList = ({ title, items, icon, type }) => {
    if (!items || items.length === 0) return null;

    return (
      <div className="mb-12">
        <div className="mb-6">
          <h2 className="text-white text-2xl lg:text-3xl font-bold font-secondary flex items-center gap-3">
            <span className="material-symbols-outlined text-3xl text-red-600">{icon}</span>
            {title}
          </h2>
        </div>
        <div data-horizontal-scroll="true" className="flex overflow-x-scroll scrollbar-hide gap-4 pb-4">
          {items.map((item) => {
            const movie = {
              id: item.id,
              poster_path: item.poster_path,
              title: item.title,
              name: item.name,
              release_date: item.release_date,
              first_air_date: item.first_air_date,
              vote_average: item.vote_average,
              media_type: type
            };
            const media = tmdbAdapter(movie);
            if (!media) return null;
            return (
              <MediaCard 
                key={media.id} 
                media={media} 
                cardSize="compact"
                onClick={() => navigate(media.mediaType === 'tv' ? `/shows/${media.id}` : `/movie/${media.id}`)}
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
    <div className="min-h-screen premium-page">
      <Header />
      <MainContainer />
      
      <div className="w-full px-6 lg:px-12 py-8">
        <MediaList
          title="Popular Movies"
          items={movies.popularMovies}
          icon="trending_up"
          type="movie"
        />
        
        <MediaList
          title="Top Rated Movies"
          items={movies.topRatedMovies}
          icon="star"
          type="movie"
        />
        
        <MediaList
          title="Upcoming Movies"
          items={movies.upcomingMovies}
          icon="event"
          type="movie"
        />
        <MediaList
          title="Action"
          items={movies.genreMovies?.[28]}
          icon="sports_martial_arts"
          type="movie"
        />
        <MediaList
          title="Adventure"
          items={movies.genreMovies?.[12]}
          icon="explore"
          type="movie"
        />
        <MediaList
          title="Romance"
          items={movies.genreMovies?.[10749]}
          icon="favorite"
          type="movie"
        />
        
        <MediaList
          title="On The Air TV Shows"
          items={tvShows.onTheAirTVShows}
          icon="live_tv"
          type="tv"
        />
        
        <MediaList
          title="Popular TV Shows"
          items={tvShows.popularTVShows}
          icon="trending_up"
          type="tv"
        />
        
        <MediaList
          title="Top Rated TV Shows"
          items={tvShows.topRatedTVShows}
          icon="star"
          type="tv"
        />
        <MediaList
          title="Action & Adventure"
          items={tvShows.genreTVShows?.[10759]}
          icon="sports_martial_arts"
          type="tv"
        />
        <MediaList
          title="Comedy"
          items={tvShows.genreTVShows?.[35]}
          icon="mood"
          type="tv"
        />
        <MediaList
          title="Romance"
          items={tvShows.genreTVShows?.[10749]}
          icon="favorite"
          type="tv"
        />
      </div>
    </div>
  );
};

export default Browse;
