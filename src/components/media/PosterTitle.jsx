// src/components/PosterTitle.jsx - UPDATED
import React, { useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { addToList } from "../../util/firestoreService";
import MoviePlayer from "../movie/Player/MoviePlayer";
import { Play, Plus } from "lucide-react";

const PosterTitle = ({ movie }) => {
  const user = useSelector((store) => store.user.user);
  const { id, original_title, overview, poster_path } = movie;
  const [showPlayer, setShowPlayer] = useState(false);
  const navigate = useNavigate();

  const handleAddToWatchlist = async () => {
    if (!user) {
      alert("Please log in to add movies to your watchlist.");
      return;
    }

    try {
      const mediaItem = {
        id,
        title: original_title,
        poster_path,
        overview,
        release_date: movie.release_date,
        vote_average: movie.vote_average,
        type: "movie",
      };

      await addToList(user.uid, "watchlist", mediaItem);
      alert(`${mediaItem.title} added to your watchlist!`);
    } catch (error) {
      console.error("Error adding to watchlist:", error);
      alert("Failed to add to watchlist. Please try again.");
    }
  };

  const handleViewDetails = () => {
    navigate(`/movie/${id}`);
  };

  const handlePlayMovie = () => {
    if (!user) {
      alert("Please log in to watch movies.");
      return;
    }
    console.log(`Starting playback: ${original_title} (TMDB ID: ${id})`);
    setShowPlayer(true);
  };

  return (
    <>
      <div className="absolute inset-0 flex items-center justify-start z-20">
        <div className="ml-12 max-w-lg">
          <h1 className="text-5xl md:text-6xl font-bold text-white drop-shadow-2xl mb-4">
            {original_title}
          </h1>
          <p className="text-lg text-gray-200 mb-8 leading-relaxed drop-shadow-lg">
            {overview}
          </p>
          <div className="flex gap-4">
            <button
              onClick={handlePlayMovie}
              className="flex items-center gap-2 px-8 py-3 bg-white text-black text-xl font-semibold rounded hover:bg-gray-200 transition-all duration-300 transform hover:scale-105"
            >
              <Play className="w-6 h-6" />
              Play Now
            </button>
            <button
              onClick={handleViewDetails}
              className="flex items-center gap-2 px-8 py-3 bg-gray-600/80 text-white text-xl font-semibold rounded hover:bg-gray-500/80 transition-all duration-300 transform hover:scale-105"
            >
              <Plus className="w-6 h-6" />
              View Details
            </button>
            <button
              onClick={handleAddToWatchlist}
              className="flex items-center gap-2 px-8 py-3 bg-gray-600/80 text-white text-xl font-semibold rounded hover:bg-gray-500/80 transition-all duration-300 transform hover:scale-105"
            >
              <Plus className="w-6 h-6" />
              My List
            </button>
          </div>
        </div>
      </div>

      {/* Movie Player Modal */}
      {showPlayer && (
        <MoviePlayer movie={movie} onClose={() => setShowPlayer(false)} />
      )}
    </>
  );
};

export default PosterTitle;
