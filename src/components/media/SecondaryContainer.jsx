import React from "react";
import { useSelector } from "react-redux";
import { Star, Flame, Play, Calendar } from "lucide-react";
import { tmdbAdapter } from "../../domain/media";
import MediaCard from "../ui/MediaCard";
import Carousel from "../ui/Carousel";
import SectionHeader from "../ui/SectionHeader";
import { useNavigate } from "react-router-dom";

const SecondaryContainer = () => {
  const movies = useSelector((store) => store.movies);
  const navigate = useNavigate();

  // If no movies, don't render anything
  if (!movies.nowPlayingMovies) return null;

  const MovieList = ({ title, movies, icon }) => {
    if (!movies || movies.length === 0) return null;

    return (
      <div className="mb-10 px-6 lg:px-12">
        <SectionHeader title={title} icon={icon} />
        <Carousel>
          {movies.map((movie) => {
            const media = tmdbAdapter(movie);
            if (!media) return null;
            return (
              <MediaCard 
                key={media.id} 
                media={media}
                variant="recommendation"
                onClick={() => navigate(`/movie/${media.id}`)}
              />
            );
          })}
        </Carousel>
      </div>
    );
  };

  return (
    <div className="relative bg-black pt-16 pb-20">
      <div className="max-w-[1600px] mx-auto w-full">
        <MovieList title="Now Playing" movies={movies.nowPlayingMovies} icon={<Flame className="w-6 h-6" />} />
        <MovieList title="Popular Movies" movies={movies.popularMovies} icon={<Play className="w-6 h-6 text-white" />} />
        <MovieList title="Top Rated" movies={movies.topRatedMovies} icon={<Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />} />
        <MovieList title="Upcoming" movies={movies.upcomingMovies} icon={<Calendar className="w-6 h-6 text-blue-400" />} />
      </div>
    </div>
  );
};

export default SecondaryContainer;