import React, { useState, useRef, useEffect } from "react";
import { addToList } from "../../../util/firebase/firestoreService";
import { options } from "../../../util/core/constants";
import {
  Star,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import useRequireAuth from "../../../hooks/common/useRequireAuth";

const MoviePlayer = ({ movieId, onClose }) => {
  const [movieDetails, setMovieDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [streamingUrl, setStreamingUrl] = useState("");
  const [currentServerIndex, setCurrentServerIndex] = useState(0);
  const [isAddedToWatched, setIsAddedToWatched] = useState(false);

  const user = useRequireAuth();
  const iframeRef = useRef(null);

  const alternativeServers = React.useMemo(() => {
    const servers = [];
    
    if (import.meta.env.VITE_STREAM_URL_1) {
      servers.push({
        name: "RiveStream1",
        url: `${import.meta.env.VITE_STREAM_URL_1}?type=movie&id=${movieId}`,
      });
    }
    
    if (import.meta.env.VITE_STREAM_URL_2) {
      servers.push({
        name: "RiveStream2",
        url: `${import.meta.env.VITE_STREAM_URL_2}?type=movie&id=${movieId}`,
      });
    }
    
    if (import.meta.env.VITE_STREAM_URL_3) {
      servers.push({
        name: "MultiEmbed",
        url: `${import.meta.env.VITE_STREAM_URL_3}?video_id=${movieId}&tmdb=1`,
      });
    }
    
    if (import.meta.env.VITE_STREAM_URL_4) {
      servers.push({
        name: "Seapi",
        url: `${import.meta.env.VITE_STREAM_URL_4}?type=movie&id=${movieId}`,
      });
    }
    
    if (import.meta.env.VITE_STREAM_URL_5) {
      servers.push({
        name: "Autoembed",
        url: `${import.meta.env.VITE_STREAM_URL_5}?type=movie&id=${movieId}`,
      });
    }
    
    if (import.meta.env.VITE_STREAM_URL_6) {
      servers.push({
        name: "Vidbinge",
        url: `${import.meta.env.VITE_STREAM_URL_6}?type=movie&id=${movieId}`,
      });
    }
    
    if (import.meta.env.VITE_STREAM_URL_7) {
      servers.push({
        name: "Embedsito",
        url: `${import.meta.env.VITE_STREAM_URL_7}?type=movie&id=${movieId}`,
      });
    }
    
    if (import.meta.env.VITE_STREAM_URL_8) {
      servers.push({
        name: "Vidsrc",
        url: `${import.meta.env.VITE_STREAM_URL_8}/${movieId}`,
      });
    }
    
    return servers;
  }, [movieId]);

  useEffect(() => {
    const fetchMovieDetails = async () => {
      try {
        const response = await fetch(
          `https://api.themoviedb.org/3/movie/${movieId}?language=en-US`,
          options
        );
        const data = await response.json();
        setMovieDetails(data);
      } catch (error) {
        console.error("Error fetching movie details:", error);
      }
    };

    fetchMovieDetails();
  }, [movieId]);

  const handleAddToWatched = React.useCallback(async () => {
    if (!user || isAddedToWatched) return;

    try {
      const watchedItem = {
        id: movieId,
        title: movieDetails?.original_title,
        poster_path: movieDetails?.poster_path,
        overview: movieDetails?.overview,
        release_date: movieDetails?.release_date,
        vote_average: movieDetails?.vote_average,
        watched_at: new Date().toISOString(),
        type: "movie",
      };

      await addToList(user.uid, "watched", watchedItem);
      setIsAddedToWatched(true);
      console.log(`Added ${movieDetails?.original_title} to watched list`);
    } catch (error) {
      console.error("Error adding to watched list:", error);
    }
  }, [user, isAddedToWatched, movieId, movieDetails]);

  useEffect(() => {
    if (!user) return;
    
    const loadMovieStream = async () => {
      try {
        setIsLoading(true);
        setHasError(false);

        const currentServer = alternativeServers[currentServerIndex];
        console.log(
          `Loading ${currentServer.name}: ${movieDetails?.original_title} (TMDB ID: ${movieId})`
        );
        console.log(`Stream URL: ${currentServer.url}`);
        
        setStreamingUrl(currentServer.url);

        setTimeout(() => {
          if (!isAddedToWatched) {
            handleAddToWatched();
          }
        }, 30000);
      } catch (error) {
        console.error("Error loading movie stream:", error);
        setHasError(true);
        setIsLoading(false);
      }
    };

    if (movieDetails && alternativeServers.length > 0) {
      loadMovieStream();
    } else if (movieDetails && alternativeServers.length === 0) {
      setHasError(true);
      setIsLoading(false);
    }
  }, [movieDetails, user, currentServerIndex, alternativeServers, isAddedToWatched, handleAddToWatched, movieId]);

  const handleTryNextServer = () => {
    if (currentServerIndex < alternativeServers.length - 1) {
      setCurrentServerIndex(currentServerIndex + 1);
      setHasError(false);
    } else {
      setCurrentServerIndex(0);
      setHasError(false);
    }
  };

  const handleTryPrevServer = () => {
    if (currentServerIndex > 0) {
      setCurrentServerIndex(currentServerIndex - 1);
    } else {
      setCurrentServerIndex(alternativeServers.length - 1);
    }
    setHasError(false);
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] bg-gray-900 rounded-xl overflow-hidden shadow-2xl">
        <div className="flex justify-between items-center p-4 bg-gray-800">
          <div className="min-w-0">
            <h1 className="text-white text-xl font-bold truncate">
              {movieDetails?.original_title}
            </h1>
            <div className="flex items-center gap-4 text-sm text-gray-300 mt-1">
              <span>{movieDetails?.release_date?.split("-")[0]}</span>
              <span className="flex items-center">
                <Star className="w-4 h-4 mr-1 text-yellow-400" />
                {movieDetails?.vote_average}/10
              </span>
              <span className="bg-blue-600 px-2 py-1 rounded text-xs">
                Server: {alternativeServers[currentServerIndex]?.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <button
                onClick={handleTryPrevServer}
                disabled={alternativeServers.length <= 1}
                className="text-white hover:text-blue-400 p-2 rounded bg-gray-700/50 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Previous Server"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleTryNextServer}
                disabled={alternativeServers.length <= 1}
                className="text-white hover:text-blue-400 p-2 rounded bg-gray-700/50 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Next Server"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            <button
              onClick={onClose}
              className="text-white hover:text-red-400 p-2 rounded bg-gray-700/50 hover:bg-gray-600 ml-2"
              title="Close Player"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="relative w-full h-96 md:h-[500px] bg-black">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-red-600 mx-auto"></div>
                <div className="mt-4 text-white text-lg">Loading movie...</div>
                <div className="mt-2 text-gray-400 text-sm">
                  Connecting to {alternativeServers[currentServerIndex]?.name} servers
                </div>
              </div>
            </div>
          )}

          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center max-w-md">
                <div className="text-red-500 mb-4">
                  <svg
                    className="w-16 h-16 mx-auto"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
                    />
                  </svg>
                </div>
                <h3 className="text-white text-xl mb-2">Streaming Error</h3>
                <p className="text-gray-400 mb-4">
                  Unable to load "{movieDetails?.original_title}" from any
                  server.
                </p>
                <p className="text-gray-500 text-sm mb-6">
                  TMDB ID: {movieId} • Tried {currentServerIndex + 1} of {alternativeServers.length} servers
                </p>
                <div className="space-y-2">
                  <button
                    onClick={() => window.location.reload()}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded mr-2"
                  >
                    Retry
                  </button>
                  <button
                    onClick={onClose}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded"
                  >
                    Close Player
                  </button>
                </div>
              </div>
            </div>
          )}

          {!isLoading && !hasError && streamingUrl && (
            <iframe
              ref={iframeRef}
              src={streamingUrl}
              className="w-full h-full border-0"
              title={`Streaming ${movieDetails?.original_title}}`}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-top-navigation-by-user-activation"
              onLoad={() => {
                console.log("Iframe loaded with URL:", streamingUrl);
              }}
              onError={(e) => {
                console.error("Iframe error:", e);
                setHasError(true);
              }}
            />
          )}
        </div>

        <div className="p-4 bg-gray-800">
          <h3 className="text-white font-semibold mb-2">Plot</h3>
          <p className="text-gray-300 text-sm">
            {movieDetails?.overview || "Loading movie details..."}
          </p>
        </div>
      </div>
    </div>
  );
};

export default MoviePlayer;
