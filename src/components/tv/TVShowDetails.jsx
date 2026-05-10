import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { options, IMG_CDN_URL } from "../../util/core/constants";
import {
  setTVShowDetails,
  setTVShowSeasons,
  setSelectedSeason,
} from "../../util/store/tvShowsSlice";
import { addToList } from "../../util/firebase/firestoreService";
import { upsertLibraryItemV2 } from "../../util/firebase/firestoreService";
import { addItem } from "../../util/store/listsSlice";
import TVShowPlayer from "./TVShowPlayer";
import Header from "../layout/Header";
import { ArrowLeft, Play, Plus, Star } from "lucide-react";
import useImdbTitle from "../../hooks/media/useImdbTitle";
import useRequireAuth from "../../hooks/common/useRequireAuth";
import AddToListPopover from "../lists/AddToListPopover";
import CreateListModal from "../lists/CreateListModal";

// Helper function to format large numbers
const formatCount = (num) => {
  if (num === null || num === undefined) return 'N/A';
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'k';
  }
  return num.toString();
};

const TVShowDetails = () => {
  const { tvId } = useParams();
  const navigate = useNavigate();
  
  // Get IMDb data for this TV show using the new hook
  const { data: imdbData, loading: imdbLoading, error: imdbError } = useImdbTitle(tvId, "tv");

  const dispatch = useDispatch();
  const user = useRequireAuth();
  const { tvShowDetails, tvShowSeasons, selectedSeason } = useSelector(
    (store) => store.tvShows
  );
  
  const [showPlayer, setShowPlayer] = useState(false);
  const [selectedEpisode, setSelectedEpisode] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPopover, setShowPopover] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const fetchSeasonDetails = React.useCallback(async (seasonNumber) => {
    try {
      const seasonResponse = await fetch(
        `https://api.themoviedb.org/3/tv/${tvId}/season/${seasonNumber}?language=en-US`,
        options
      );
      const seasonData = await seasonResponse.json();
      dispatch(setTVShowSeasons(seasonData));
      dispatch(setSelectedSeason(seasonNumber));
    } catch (error) {
      console.error("Error fetching season details:", error);
    }
  }, [tvId, dispatch]);

  const fetchTVShowDetails = React.useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch detailed TV show information with images
      const detailsResponse = await fetch(
        `https://api.themoviedb.org/3/tv/${tvId}?language=en-US&append_to_response=images&include_image_language=en,null`,
        options
      );
      const detailsData = await detailsResponse.json();
      dispatch(setTVShowDetails(detailsData));

      // Fetch season details
      if (detailsData.seasons && detailsData.seasons.length > 0) {
        const firstSeason =
          detailsData.seasons.find((s) => s.season_number === 1) ||
          detailsData.seasons[0];
        await fetchSeasonDetails(firstSeason.season_number);
      }

      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching TV show details:", error);
      setIsLoading(false);
    }
  }, [tvId, dispatch, fetchSeasonDetails]);

  useEffect(() => {
    fetchTVShowDetails();
  }, [tvId, fetchTVShowDetails]);

  const handleSeasonChange = (seasonNumber) => {
    fetchSeasonDetails(seasonNumber);
  };

  const handlePlayEpisode = (episode) => {
    if (!user) {
      alert("Please log in to watch episodes.");
      return;
    }
    setSelectedEpisode(episode);
    setShowPlayer(true);
  };

  const handleAddToWatchlist = async () => {
    if (!user) {
      alert("Please log in to add shows to your watchlist.");
      return;
    }

    try {
      const mediaItem = {
        id: tvId,
        title: tvShowDetails?.name || "TV Show",
        poster_path: tvShowDetails?.poster_path,
        overview: tvShowDetails?.overview,
        first_air_date: tvShowDetails?.first_air_date,
        vote_average: tvShowDetails?.vote_average,
        vote_count: tvShowDetails?.vote_count,
        imdbRating: imdbData?.rating?.aggregateRating || imdbData?.rating?.ratingValue || null,
        imdbVotes: imdbData?.rating?.voteCount || imdbData?.rating?.ratingCount || null,
        imdbId: imdbData?.id || null,
        media_type: "tv",
        type: "tv",
      };

      await addToList(user.uid, "watchlist", mediaItem);
      alert(`${mediaItem.title} added to your watchlist!`);
    } catch (error) {
      console.error("Error adding to watchlist:", error);
      alert("Failed to add to watchlist. Please try again.");
    }
  };

  const handleSelectList = async (selection) => {
    if (!user) {
      alert("Please log in to add shows to your lists.");
      setShowPopover(false);
      return;
    }

    try {
      const mediaItem = {
        id: tvId,
        title: tvShowDetails?.name || "TV Show",
        poster_path: tvShowDetails?.poster_path,
        overview: tvShowDetails?.overview,
        first_air_date: tvShowDetails?.first_air_date,
        vote_average: tvShowDetails?.vote_average,
        vote_count: tvShowDetails?.vote_count,
        imdbRating: imdbData?.rating?.aggregateRating || imdbData?.rating?.ratingValue || null,
        imdbVotes: imdbData?.rating?.voteCount || imdbData?.rating?.ratingCount || null,
        imdbId: imdbData?.id || null,
        media_type: "tv",
        type: "tv",
      };

      if (selection?.kind === 'system') {
        const status = selection.action === 'completed' ? 'completed' : 'plan_to_watch';
        await upsertLibraryItemV2(user.uid, mediaItem, { status });
        alert(
          selection.action === 'completed'
            ? `${mediaItem.title} marked as completed!`
            : `${mediaItem.title} added to watchlist!`
        );
      } else if (selection?.kind === 'custom' && selection?.listId) {
        await dispatch(addItem({ 
          userId: user.uid, 
          listId: selection.listId,
          mediaItem 
        })).unwrap();
        await upsertLibraryItemV2(user.uid, mediaItem, { listId: selection.listId, status: null });
        alert(`${mediaItem.title} added to your list!`);
      }
      
      setShowPopover(false);
    } catch (error) {
      console.error("Error adding to list:", error);
      alert("Failed to add to list. Please try again.");
    }
  };

  const handleCreateNew = () => {
    setShowPopover(false);
    setShowCreateModal(true);
  };

  if (isLoading) {
    return (
      <div className="bg-black min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto"></div>
          <div className="mt-4 text-white text-lg">Loading TV Show...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      <Header />
      
      <div className="bg-black min-h-screen">
        {/* Background Image */}
        <div
          className="relative h-screen bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${IMG_CDN_URL}${
              tvShowDetails?.backdrop_path
            })`,
          }}
        >
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/70 to-black/30"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent"></div>

          {/* Back Button */}
          <button
            onClick={() => navigate("/TVShows")}
            className="absolute top-6 left-6 z-20 bg-black/50 hover:bg-black/70 text-white p-3 rounded-full transition-all duration-300"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>

          {/* Content */}
          <div className="absolute bottom-0 left-0 right-0 p-12 z-10">
            <div className="max-w-4xl">
              {/* Title Logo or Text */}
              {tvShowDetails?.images?.logos?.length > 0 ? (
                <div className="mb-4">
                  <img 
                    src={`https://image.tmdb.org/t/p/w500${tvShowDetails.images.logos[0].file_path}`}
                    alt={`${tvShowDetails.name} Logo`}
                    className="max-w-full h-auto max-h-32 object-contain"
                  />
                </div>
              ) : (
                <h1 className="text-6xl font-bold text-white mb-4 drop-shadow-2xl">
                  {tvShowDetails?.name}
                </h1>
              )}

              {/* Rating Section with Progressive Loading */}
              <div className="mb-4">
                {/* Multi-source Rating Grid */}
                <div className="grid grid-cols-2 md:grid-cols-2 gap-2 mb-2">
                  {/* TMDB Rating Card */}
                  <div className="bg-gray-800/80 backdrop-blur-sm border border-gray-700 rounded-lg p-2 text-center">
                    <div className="text-xs text-gray-400 uppercase tracking-wider">TMDB</div>
                    <div className="text-lg font-bold text-white mt-1">
                      {tvShowDetails?.vote_average?.toFixed(1) || 'N/A'}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {tvShowDetails?.vote_count ? `${formatCount(tvShowDetails.vote_count)} votes` : 'User Rating'}
                    </div>
                  </div>
                  
                  {/* IMDb Rating Card */}
                  <div className="bg-gray-800/80 backdrop-blur-sm border border-gray-700 rounded-lg p-2 text-center">
                    <div className="text-xs text-gray-400 uppercase tracking-wider">IMDb</div>
                    <div className="text-lg font-bold text-white mt-1">
                      {imdbLoading ? (
                        <div className="h-5 w-6 bg-gray-600 rounded-full animate-pulse mx-auto"></div>
                      ) : imdbData && imdbData.rating && imdbData.rating.aggregateRating ? (
                        imdbData.rating.aggregateRating
                      ) : (
                        'N/A'
                      )}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      {imdbData && imdbData.rating && imdbData.rating.voteCount ? 
                        `${formatCount(imdbData.rating.voteCount)} votes` : 
                        imdbLoading ? 'Loading...' : 'N/A votes'}
                    </div>
                  </div>
                </div>
                
                {/* Main Rating Display */}
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center bg-gray-900/80 backdrop-blur-sm border border-gray-700 rounded-lg px-4 py-2">
                    <Star className="w-5 h-5 mr-1 text-yellow-400 fill-yellow-400" />
                    {imdbLoading ? (
                      // Show skeleton loader when loading
                      <div className="h-5 w-8 bg-gray-600 rounded-full animate-pulse"></div>
                    ) : imdbData && imdbData.rating && imdbData.rating.aggregateRating ? (
                      // Show IMDb rating when data is available
                      <span>{imdbData.rating.aggregateRating}/10</span>
                    ) : imdbError || (!imdbData && !imdbLoading) ? (
                      // Show TMDB rating as fallback when there's an error or no data
                      <span>{tvShowDetails?.vote_average?.toFixed(1)}/10</span>
                    ) : (
                      // Default to TMDB rating while loading
                      <span>{tvShowDetails?.vote_average?.toFixed(1)}/10</span>
                    )}
                  </div>
                  
                  {imdbData && imdbData.rating && imdbData.rating.voteCount && (
                    <div className="text-gray-300 text-sm bg-gray-800/80 backdrop-blur-sm border border-gray-700 rounded-lg px-3 py-1">
                      {formatCount(imdbData.rating.voteCount)} votes
                    </div>
                  )}
                </div>
              </div>

              {/* Meta Info */}
              <div className="flex items-center gap-6 mb-6 text-lg">
                <span className="text-green-400 font-semibold">
                  {tvShowDetails?.first_air_date?.split("-")[0]}
                </span>
                <span className="text-white">
                  {tvShowDetails?.number_of_seasons} Seasons
                </span>
                <span className="bg-green-600 text-white px-3 py-1 rounded text-sm">
                  {tvShowDetails?.status}
                </span>
              </div>

              <p className="text-xl text-gray-200 mb-8 leading-relaxed max-w-3xl">
                {tvShowDetails?.overview}
              </p>

              {/* Action Buttons */}
              <div className="flex gap-4 mb-6">
                {tvShowSeasons?.episodes?.length > 0 && (
                  <button
                    onClick={() => {
                      if (tvShowSeasons?.episodes?.length > 0) {
                        handlePlayEpisode(tvShowSeasons.episodes[0]);
                      }
                    }}
                    className="flex items-center gap-2 px-8 py-4 bg-white text-black text-xl font-semibold rounded hover:bg-gray-200 transition-all duration-300 transform hover:scale-105"
                  >
                    <Play className="w-6 h-6" />
                    Play First Episode
                  </button>
                )}

                <div className="relative">
                  <button
                    onClick={handleAddToWatchlist}
                    onMouseEnter={() => setShowPopover(true)}
                    className="flex items-center gap-2 px-8 py-4 bg-gray-600/80 text-white text-xl font-semibold rounded hover:bg-gray-500/80 transition-all duration-300 transform hover:scale-105"
                  >
                    <Plus className="w-6 h-6" />
                    My List
                  </button>
                  
                  {showPopover && (
                    <div 
                      onMouseEnter={() => setShowPopover(true)}
                      onMouseLeave={() => setShowPopover(false)}
                    >
                      <AddToListPopover 
                        onSelectList={handleSelectList}
                        onCreateNew={handleCreateNew}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Genres */}
              {tvShowDetails?.genres && (
                <div className="flex flex-wrap gap-2">
                  {tvShowDetails.genres.map((genre) => (
                    <span
                      key={genre.id}
                      className="px-3 py-1 bg-gray-700/50 text-gray-300 rounded-full text-sm"
                    >
                      {genre.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Seasons & Episodes Section */}
        <div className="px-12 py-8">
          {/* Season Selector */}
          {tvShowDetails?.seasons && (
            <div className="mb-8">
              <h2 className="text-white text-2xl font-bold mb-4">Seasons</h2>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {tvShowDetails.seasons
                  .filter((season) => season.season_number > 0 || 
                                season.name.toLowerCase() === 'specials' || 
                                season.name.toLowerCase() === 'extras')
                  .map((season) => (
                    <button
                      key={season.id}
                      onClick={() => handleSeasonChange(season.season_number)}
                      className={`flex-shrink-0 px-4 py-2 rounded-full font-medium transition-all duration-300 ${
                        selectedSeason === season.season_number
                          ? "bg-green-600 text-white"
                          : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                      }`}
                    >
                      {season.name}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Episodes */}
          {tvShowSeasons?.episodes && (
            <div>
              <h2 className="text-white text-2xl font-bold mb-6">
                {tvShowDetails?.seasons?.find(s => s.season_number === selectedSeason)?.name || `Season ${selectedSeason}`} Episodes
              </h2>
              <div className="grid gap-4">
                {tvShowSeasons.episodes.map((episode) => (
                  <div
                    key={episode.id}
                    className="bg-gray-900/50 rounded-lg p-4 hover:bg-gray-800/50 transition-all duration-300 cursor-pointer"
                    onClick={() => handlePlayEpisode(episode)}
                  >
                    <div className="flex gap-4">
                      {episode.still_path && (
                        <img
                          src={`${IMG_CDN_URL}${episode.still_path}`}
                          alt={episode.name}
                          className="w-32 h-18 object-cover rounded flex-shrink-0"
                        />
                      )}
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="text-white text-lg font-semibold">
                              {episode.name}
                            </h3>
                            <span className="text-gray-400 text-sm">
                              Episode {episode.episode_number}
                            </span>
                          </div>
                          <span className="text-gray-400 text-sm flex-shrink-0">
                            {episode.runtime} min
                          </span>
                        </div>
                        <p className="text-gray-300 text-sm leading-relaxed">
                          {episode.overview}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-400">
                          <span>Air Date: {episode.air_date}</span>
                          <span className="flex items-center">
                            <Star className="w-4 h-4 mr-1 text-yellow-400 fill-yellow-400" />
                            {episode.vote_average ? episode.vote_average.toFixed(1) : 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TV Show Player Modal */}
      {showPlayer && selectedEpisode && (
        <TVShowPlayer
          tvShow={tvShowDetails}
          episode={selectedEpisode}
          season={selectedSeason}
          onClose={() => {
            setShowPlayer(false);
            setSelectedEpisode(null);
          }}
        />
      )}

      {/* Create List Modal */}
      <CreateListModal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
        userId={user?.uid} 
      />
    </>
  );
};

export default TVShowDetails;
