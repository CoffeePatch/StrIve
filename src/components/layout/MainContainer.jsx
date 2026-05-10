import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import PosterTitle from "../media/PosterTitle";
import PosterBackground from "../media/PosterBackground";

const MainContainer = () => {
  const movies = useSelector((state) => state.movies.nowPlayingMovies);
  const navigate = useNavigate();
  
  // State to store the selected movie ID to keep it consistent
  const [selectedMovieId, setSelectedMovieId] = useState(null);
  
  // Effect to select a random movie only once when movies are available
  useEffect(() => {
    if (movies && movies.length > 0 && !selectedMovieId) {
      const randomMovie = movies[Math.floor(Math.random() * movies.length)];
      setSelectedMovieId(randomMovie.id);
    }
  }, [movies, selectedMovieId]); // Only run when movies or selectedMovieId change
  
  if (!movies || movies.length === 0) return null;

  // Find the movie object based on the selected ID
  const movie = movies.find(m => m.id === selectedMovieId);
  
  if (!movie) return null; // Wait until we have a selected movie

  // Function to navigate to movie details
  const handleViewDetails = () => {
    navigate(`/movie/${movie.id}`);
  };

  return (
    <div className="relative w-full h-screen">
      {" "}
      {/* Fixed: Added proper container */}
      <PosterBackground movieID={movie.id} />
      {/* Pass the navigate function to PosterTitle */}
      <PosterTitle movie={movie} onViewDetails={handleViewDetails} />
    </div>
  );
};

export default MainContainer;
