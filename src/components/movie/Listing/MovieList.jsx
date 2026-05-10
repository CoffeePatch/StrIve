import React from "react";
import MovieCard from "../Cards/MovieCard";

const MovieList = ({ title, movies, icon }) => {
  return (
    <div className="mb-12">
      <div className="px-6 lg:px-12 mb-6">
        <h2 className="text-white text-2xl lg:text-3xl font-bold font-secondary flex items-center gap-3">
          {icon && <span className="material-symbols-outlined text-3xl text-red-600">{icon}</span>}
          {title}
        </h2>
      </div>
      <div data-horizontal-scroll="true" className="flex overflow-x-scroll scrollbar-hide px-6 lg:px-12 gap-4 pb-4">
        {movies?.map((movie) => (
          <MovieCard 
            key={movie.id} 
            movie={movie}
          />
        ))}
      </div>
    </div>
  );
};

export default MovieList;
