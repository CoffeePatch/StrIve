import { useState, useEffect, useCallback } from "react";
import useRequireAuth from "../common/useRequireAuth";
import useImdbTitle from "./useImdbTitle";
import useLibraryItemStatus from "./useLibraryItemStatus";
import { libraryAdapter } from "../../domain/library/libraryAdapter";
import { options } from "../../util/core/constants";

const useMediaDetailsCore = ({ mediaId, mediaType }) => {
  const user = useRequireAuth();
  
  const [mediaDetails, setMediaDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { data: imdbData, loading: imdbLoading } = useImdbTitle(mediaId, mediaType);

  const fetchDetails = useCallback(async () => {
    if (!mediaId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      let data = null;
      
      if (mediaType === "tv") {
        const response = await fetch(`/api/tv/details?tvId=${mediaId}`);
        if (!response.ok) throw new Error("Failed to fetch TV details");
        data = await response.json();
      } else {
        const response = await fetch(
          `https://api.themoviedb.org/3/movie/${mediaId}?language=en-US&append_to_response=images,credits,similar,videos&include_image_language=en,null`,
          options
        );
        if (!response.ok) throw new Error("Failed to fetch Movie details");
        data = await response.json();
      }

      // Domain normalization logic
      const normalizedDetails = {
        ...data,
        id: data.id,
        title: data.title || data.name,
        posterPath: data.poster_path || data.posterPath,
        backdropPath: data.backdrop_path || data.backdropPath,
        releaseYear: (data.release_date || data.first_air_date || data.firstAirDate || "").split("-")[0],
        releaseDate: data.release_date || data.first_air_date || data.firstAirDate,
        overview: data.overview,
        voteAverage: data.vote_average ?? data.voteAverage,
        voteCount: data.vote_count ?? data.voteCount,
        genres: data.genres || [],
        status: data.status,
        runtime: data.runtime,
        numberOfSeasons: data.numberOfSeasons || data.number_of_seasons,
        numberOfEpisodes: data.numberOfEpisodes || data.number_of_episodes,
        mediaType,
      };

      setMediaDetails(normalizedDetails);
    } catch (err) {
      console.error(`Error in useMediaDetailsCore for ${mediaType}:`, err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [mediaId, mediaType]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Construct standard payload for Firestore lists
  const mediaItemForLists = mediaDetails ? {
    id: mediaDetails.id,
    title: mediaDetails.title,
    name: mediaDetails.title,
    poster_path: mediaDetails.posterPath,
    overview: mediaDetails.overview,
    release_date: mediaDetails.releaseDate,
    first_air_date: mediaDetails.releaseDate,
    vote_average: mediaDetails.voteAverage,
    vote_count: mediaDetails.voteCount,
    runtime: mediaDetails.runtime,
    genres: mediaDetails.genres,
    number_of_episodes: mediaDetails.numberOfEpisodes,
    images: { tmdbPoster: mediaDetails.posterPath || "" },
    ratings: {
      tmdbScore: mediaDetails.voteAverage || 0,
      tmdbVotes: mediaDetails.voteCount || 0,
      imdbScore: imdbData?.rating?.aggregateRating || imdbData?.rating?.ratingValue || null,
      imdbVotes: imdbData?.rating?.voteCount || imdbData?.rating?.ratingCount || null,
    },
    imdbId: imdbData?.id || (mediaId && String(mediaId).startsWith("tt") ? mediaId : null),
    imdbRating: imdbData?.rating?.aggregateRating || imdbData?.rating?.ratingValue || null,
    imdbVotes: imdbData?.rating?.voteCount || imdbData?.rating?.ratingCount || null,
    media_type: mediaType,
  } : null;

  // Hydrate Library Status
  const { isWatchlisted: firestoreIsWatchlisted, isCompleted: firestoreIsCompleted } = useLibraryItemStatus({
    userId: user?.uid,
    mediaItem: mediaDetails ? { id: mediaDetails.id, media_type: mediaType } : null,
    realtime: true,
  });

  const [isWatchlisted, setIsWatchlisted] = useState(false);
  const [isWatched, setIsWatched] = useState(false);

  useEffect(() => {
    setIsWatchlisted(Boolean(firestoreIsWatchlisted));
    setIsWatched(Boolean(firestoreIsCompleted));
  }, [firestoreIsWatchlisted, firestoreIsCompleted]);

  // Handle Shared Mutations
  const handleToggleWatchlist = async () => {
    if (!user) {
      alert("Please log in first.");
      return;
    }
    try {
      if (isWatchlisted) {
        await libraryAdapter.removeFromWatchlist(user.uid, mediaItemForLists);
        setIsWatchlisted(false);
      } else {
        await libraryAdapter.addToWatchlist(user.uid, mediaItemForLists);
        setIsWatchlisted(true);
        setIsWatched(false);
      }
    } catch (error) {
      console.error("Error updating watchlist:", error);
    }
  };

  const handleToggleWatched = async () => {
    if (!user) {
      alert("Please log in first.");
      return;
    }
    try {
      if (isWatched) {
        await libraryAdapter.unmarkCompleted(user.uid, mediaItemForLists);
        setIsWatched(false);
      } else {
        await libraryAdapter.markCompleted(user.uid, mediaItemForLists);
        setIsWatched(true);
        setIsWatchlisted(false);
      }
    } catch (error) {
      console.error("Error updating watched status:", error);
    }
  };

  return {
    user,
    mediaDetails,
    loading,
    error,
    imdbData,
    imdbLoading,
    isWatchlisted,
    isWatched,
    handleToggleWatchlist,
    handleToggleWatched,
    mediaItemForLists
  };
};

export default useMediaDetailsCore;
