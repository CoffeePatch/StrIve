import React, { useState, useRef, useEffect } from "react";
import { RiveStreamingService } from "../../util/core/riveService";
import { upsertLibraryItem } from "../../../util/firebase/firestoreService";
import { Star, Maximize, RotateCw, X, Lock } from "lucide-react";
import useRequireAuth from "../../hooks/common/useRequireAuth";

const TVShowPlayer = ({ tvShow, episode, season, onClose }) => {
  console.log("TVShowPlayer mounted with tvShow:", tvShow, "episode:", episode, "season:", season);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [streamingUrl, setStreamingUrl] = useState("");
  const [currentServerIndex, setCurrentServerIndex] = useState(0);
  const [isAddedToWatched, setIsAddedToWatched] = useState(false);

  const user = useRequireAuth();
  const iframeRef = useRef(null);

  const alternativeServers = React.useMemo(() => [
    {
      name: "RiveStream TV",
      url: `https://rivestream.org/embed?type=tv&id=${tvShow.id}&season=${season}&episode=${episode.episode_number}`,
    },
    {
      name: "Cinemaos TV",
      url: `${import.meta.env.VITE_CINEMAOS_URL}/${tvShow.id}/${season}/${episode.episode_number}`,
    },
    {
      name: "2Embed TV",
      url: `${import.meta.env.VITE_2EMBED_URL}/tv?id=${tvShow.id}&s=${season}&e=${episode.episode_number}`,
    },
    {
      name: "MultiEmbed TV",
      url: `${import.meta.env.VITE_MULTIEMBED_URL}/directstream.php?video_id=${tvShow.id}&tmdb=1&s=${season}&e=${episode.episode_number}`,
    },
  ], [tvShow.id, season, episode.episode_number]);

  const handleAddToWatched = React.useCallback(async () => {
    if (!user || isAddedToWatched) return;

    try {
      const watchedItem = {
        id: tvShow.id,
        title: tvShow.name,
        poster_path: tvShow.poster_path,
        overview: tvShow.overview,
        first_air_date: tvShow.first_air_date,
        vote_average: tvShow.vote_average,
        vote_count: tvShow.vote_count,
        media_type: "tv",
      };

      await upsertLibraryItem(user.uid, watchedItem, { status: "Completed" });
      setIsAddedToWatched(true);
      console.log(
        `Added ${tvShow.name} S${season}E${episode.episode_number} to watched list`
      );
    } catch (error) {
      console.error("Error adding to watched list:", error);
    }
  }, [user, isAddedToWatched, tvShow, season, episode]);

  useEffect(() => {
    if (!user) return;

    const loadEpisodeStream = async () => {
      try {
        setIsLoading(true);
        setHasError(false);

        const currentServer = alternativeServers[currentServerIndex];
        console.log(
          `Loading ${currentServer.name}: ${tvShow.name} S${season}E${episode.episode_number} - ${episode.name}`
        );
        console.log(`Stream URL: ${currentServer.url}`);

        setStreamingUrl(currentServer.url);

        setTimeout(() => {
          setIsLoading(false);
        }, 2000);

        setTimeout(() => {
          if (!isAddedToWatched) {
            handleAddToWatched();
          }
        }, 30000);
      } catch (error) {
        console.error("Error loading episode stream:", error);
        setHasError(true);
        setIsLoading(false);
      }
    };

    loadEpisodeStream();
  }, [tvShow.id, tvShow.name, season, episode.episode_number, episode.name, user, currentServerIndex, handleAddToWatched, isAddedToWatched, alternativeServers]);

  const handleTryNextServer = () => {
    if (currentServerIndex < alternativeServers.length - 1) {
      setCurrentServerIndex(currentServerIndex + 1);
    } else {
      setHasError(true);
    }
  };

  const handleFullScreen = () => {
    if (iframeRef.current) {
      if (iframeRef.current.requestFullscreen) {
        iframeRef.current.requestFullscreen();
      } else if (iframeRef.current.webkitRequestFullscreen) {
        iframeRef.current.webkitRequestFullscreen();
      }
    }
  };

  if (!user) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-98 flex items-center justify-center z-50">
      <div className="w-full h-full max-w-7xl max-h-full p-2 md:p-4">
        <div className="flex justify-between items-center mb-2 md:mb-4 bg-gray-900/80 p-3 rounded-lg">
          <div className="flex-1">
            <h1 className="text-white text-lg md:text-2xl font-bold truncate">
              {tvShow.name} - S{season}E{episode.episode_number}
            </h1>
            <h2 className="text-gray-300 text-md md:text-lg truncate">
              {episode.name}
            </h2>
            <div className="flex items-center gap-4 text-sm text-gray-300 mt-1">
              <span>{episode.air_date}</span>
              <span className="flex items-center">
                <Star className="w-4 h-4 mr-1 text-yellow-400" />
                {episode.vote_average}/10
              </span>
              <span className="bg-green-600 px-2 py-1 rounded text-xs">
                Server: {alternativeServers[currentServerIndex]?.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTryNextServer}
              disabled={currentServerIndex >= alternativeServers.length - 1}
              className="text-white hover:text-blue-400 p-2 rounded bg-gray-700/50 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Try Next Server"
            >
              <RotateCw className="w-5 h-5" />
            </button>

            <button
              onClick={handleFullScreen}
              className="text-white hover:text-yellow-400 p-2 rounded bg-gray-700/50 hover:bg-gray-600"
              title="Fullscreen"
            >
              <Maximize className="w-5 h-5" />
            </button>

            <button
              onClick={onClose}
              className="text-white hover:text-red-400 p-2 rounded bg-gray-700/50 hover:bg-gray-600"
              title="Close Player"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="relative w-full h-5/6 bg-gray-900 rounded-lg overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto"></div>
                <div className="mt-4 text-white text-lg">Loading Episode...</div>
                <div className="mt-2 text-gray-400 text-sm">S{season}E{episode.episode_number} - {episode.name}</div>
              </div>
            </div>
          )}

          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center max-w-md">
                <div className="text-green-500 mb-4">
                  <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                  </svg>
                </div>
                <h3 className="text-white text-xl mb-2">Streaming Error</h3>
                <p className="text-gray-400 mb-4">Unable to load "{episode.name}" from any server.</p>
                <p className="text-gray-500 text-sm mb-6">{tvShow.name} S{season}E{episode.episode_number} • Tried {currentServerIndex + 1} of {alternativeServers.length} servers</p>
                <div className="space-y-2">
                  <button onClick={() => window.location.reload()} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded mr-2">Retry</button>
                  <button onClick={onClose} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded">Close Player</button>
                </div>
              </div>
            </div>
          )}

          {!isLoading && !hasError && streamingUrl && (
            <iframe
              ref={iframeRef}
              src={streamingUrl}
              className="w-full h-full border-0"
              title={`Streaming ${episode.name}`}
              allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              onLoad={() => console.log("TV Show iframe loaded with URL:", streamingUrl)}
              onError={(e) => console.error("TV Show iframe error:", e)}
            />
          )}
        </div>

        <div className="mt-2 md:mt-4 bg-gray-800/80 p-3 md:p-4 rounded-lg">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <h3 className="text-white font-semibold mb-2">About this episode</h3>
              <p className="text-gray-300 text-sm leading-relaxed line-clamp-3">{episode.overview}</p>
            </div>

            <div className="flex flex-col gap-2 min-w-[200px]">
              <div className="text-gray-400 text-sm"><span className="text-white font-semibold">Episode:</span> S{season}E{episode.episode_number}</div>
              <div className="text-gray-400 text-sm"><span className="text-white font-semibold">Runtime:</span> {episode.runtime} minutes</div>
              {isAddedToWatched && (<div className="bg-green-600/20 text-green-400 text-sm p-2 rounded">✅ Added to Watched List</div>)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TVShowPlayer;
