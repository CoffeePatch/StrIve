import React from "react";
import { useSelector } from "react-redux";
import { Star, Flame, Play, Calendar } from "lucide-react";

import { tmdbAdapter } from "../../domain/media";
import { MediaCard, MediaPoster, MediaBadges, MediaMetadata } from "../media/MediaCard";
import { useNavigate } from "react-router-dom";

const SecondaryContainer = () => {
  const movies = useSelector((store) => store.movies);
  const navigate = useNavigate();

  // If no movies, don't render anything
  if (!movies.nowPlayingMovies) return null;







  if (!movies.nowPlayingMovies) return null;

  const MovieList = ({ title, movies, icon }) => {
    if (!movies) return null;

    return (
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4 px-12">
          <h2 className="text-white text-2xl font-bold flex items-center gap-2">
            {icon}
            {title}
          </h2>
          

        </div>
        

        
        <div data-horizontal-scroll="true" className="flex overflow-x-scroll scrollbar-hide px-12 pb-4">
          {movies.map((movie) => {
            const media = tmdbAdapter(movie);
            if (!media) return null;
            return (
              <MediaCard 
                key={media.id} 
                media={media}
                onClick={() => navigate(`/movie/${media.id}`)}
              >
                <MediaPoster media={media}>
                  <MediaBadges media={media} />
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
    <div className="relative bg-black pt-16 pb-20">
      <MovieList title="Now Playing" movies={movies.nowPlayingMovies} icon={<Flame className="w-6 h-6 text-red-500" />} />
      <MovieList title="Popular Movies" movies={movies.popularMovies} icon={<Play className="w-6 h-6 text-white" />} />
      <MovieList title="Top Rated" movies={movies.topRatedMovies} icon={<Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />} />
      <MovieList title="Upcoming" movies={movies.upcomingMovies} icon={<Calendar className="w-6 h-6 text-blue-400" />} />
    </div>
  );
};

export default SecondaryContainer;