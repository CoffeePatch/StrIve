import { useState, useEffect, useCallback, useMemo } from "react";
import useRequireAuth from "../common/useRequireAuth";
import useImdbTitle from "./useImdbTitle";
import useLibraryItemStatus from "./useLibraryItemStatus";
import { libraryAdapter } from "../../domain/library/libraryAdapter";
import { getOrFetch, CACHE_KEYS, TTL, invalidateContinueWatching, invalidateCatalogCache } from "../../util/cache/sessionCache";
import { createLibraryIdentity } from "../../domain/library/libraryIdentity";

const useMediaDetailsCore = ({ mediaId, mediaType }) => {
  const user = useRequireAuth();
  
  const [mediaDetails, setMediaDetails] = useState(null);
  const [seriesProgress, setSeriesProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const libraryIdentity = useMemo(() => {
    if (!mediaId) return null;
    return createLibraryIdentity({
      titleKey: mediaType === "tv" ? `tmdb_tv_${mediaId}` : `tmdb_movie_${mediaId}`,
      mediaType,
      tmdbId: mediaId,
    });
  }, [mediaId, mediaType]);

  const { data: imdbData, loading: imdbLoading } = useImdbTitle(mediaId, mediaType, {
    userId: user?.uid,
    titleKey: libraryIdentity?.titleKey,
    persist: true,
  });

  const fetchDetails = useCallback(async () => {
    if (!mediaId) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      
      const cacheKey = mediaType === "tv" 
        ? CACHE_KEYS.TV_DETAILS(mediaId) 
        : CACHE_KEYS.MOVIE_DETAILS(mediaId);
      const ttl = mediaType === "tv" 
        ? TTL.TV_DETAILS 
        : TTL.MOVIE_DETAILS;

      const details = await getOrFetch({
        key: cacheKey,
        ttl,
        fetcher: async () => {
          let data = null;
          const titleKey = mediaType === "tv" ? `tmdb_tv_${mediaId}` : `tmdb_movie_${mediaId}`;
          const token = await user?.getIdToken();
          const response = await fetch(`/api/catalog/${titleKey}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          });

          if (!response.ok) {
            throw new Error(`Failed to fetch ${mediaType} details`);
          }
          
          const rawData = await response.json();
          // Unified endpoint wraps details in `{ catalog, progress }`
          data = rawData.catalog;
          const progress = rawData.progress || null;

          // Domain normalization logic
          return {
            catalog: {
              ...data,
              id: data.id,
              title: data.title || data.name,
              posterPath: data.poster_path || data.posterPath,
              backdropPath: data.backdrop_path || data.backdropPath,
              releaseYear: (data.releaseDate || data.release_date || data.first_air_date || data.firstAirDate || "").split("-")[0],
              releaseDate: data.releaseDate || data.release_date || data.first_air_date || data.firstAirDate,
              overview: data.overview,
              voteAverage: data.vote_average ?? data.voteAverage,
              voteCount: data.vote_count ?? data.voteCount,
              genres: data.genres || [],
              status: data.status,
              runtime: data.runtime,
              numberOfSeasons: data.numberOfSeasons || data.number_of_seasons,
              numberOfEpisodes: data.numberOfEpisodes || data.number_of_episodes,
              mediaType,
            },
            progress
          };
        }
      });

      if (details) {
        setMediaDetails(details.catalog || details);
        setSeriesProgress(details.progress || null);
      }
    } catch (err) {
      console.error(`Error in useMediaDetailsCore for ${mediaType}:`, err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [mediaId, mediaType, user]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  // Construct standard payload for Firestore lists
  const mediaItemForLists = mediaDetails ? {
    titleKey: mediaType === "tv" ? `tmdb_tv_${mediaDetails.id}` : `tmdb_movie_${mediaDetails.id}`,
    mediaType,
    tmdbId: mediaDetails.id,
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
      imdbScore: imdbData?.rating?.aggregateRating || imdbData?.rating?.aggregate_rating || imdbData?.rating?.ratingValue || imdbData?.aggregateRating || imdbData?.aggregate_rating || imdbData?.imdbRating || null,
      imdbVotes: imdbData?.rating?.voteCount || imdbData?.rating?.vote_count || imdbData?.rating?.votes_count || imdbData?.rating?.ratingCount || imdbData?.voteCount || imdbData?.vote_count || imdbData?.votes_count || imdbData?.imdbVotes || null,
    },
    imdbId: imdbData?.id || (mediaId && String(mediaId).startsWith("tt") ? mediaId : null),
    media_type: mediaType,
  } : null;

  // Hydrate Library Status
  const { isWatchlisted: firestoreIsWatchlisted, isCompleted: firestoreIsCompleted, trackingData } = useLibraryItemStatus({
    userId: user?.uid,
    libraryIdentity,
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
      invalidateContinueWatching(user.uid);
    } catch (error) {
      console.error("Error updating watchlist:", error);
    }
  };

  const handleToggleWatched = async (options = {}) => {
    if (!user) {
      alert("Please log in first.");
      return;
    }
    try {
      if (isWatched && !options.watchedAt) {
        await libraryAdapter.unmarkCompleted(user.uid, mediaItemForLists);
        setIsWatched(false);
      } else {
        await libraryAdapter.markCompleted(user.uid, mediaItemForLists, options);
        setIsWatched(true);
        setIsWatchlisted(false);
      }
      invalidateContinueWatching(user.uid);
    } catch (error) {
      console.error("Error updating watched status:", error);
    }
  };

  // Handle Rating Change
  const [userRating, setUserRating] = useState(null);

  useEffect(() => {
    if (mediaDetails?.userRating !== undefined) {
      setUserRating(mediaDetails.userRating);
    }
  }, [mediaDetails?.userRating]);

  const handleRatingChange = async (newRating) => {
    if (!user || !mediaItemForLists) return;
    const backupRating = userRating;
    setUserRating(newRating);
    try {
      await libraryAdapter.updateUserRating(user.uid, mediaItemForLists, newRating);
    } catch (err) {
      console.error("Failed to update user rating:", err);
      setUserRating(backupRating);
    }
  };

  // Handle Notes Change
  const [userNotes, setUserNotes] = useState(null);

  useEffect(() => {
    if (mediaDetails?.userNotes !== undefined) {
      setUserNotes(mediaDetails.userNotes);
    }
  }, [mediaDetails?.userNotes]);

  const handleNotesChange = async (newNotes) => {
    if (!user || !mediaItemForLists) return;
    const backupNotes = userNotes;
    const normalizedNotes = newNotes ? newNotes.trim() : null;
    setUserNotes(normalizedNotes);
    try {
      await libraryAdapter.updateUserNotes(user.uid, mediaItemForLists, normalizedNotes);
      invalidateCatalogCache(mediaId, mediaType);
    } catch (err) {
      console.error("Failed to update user notes:", err);
      setUserNotes(backupNotes);
      throw err;
    }
  };

  return {
    user,
    mediaDetails,
    seriesProgress,
    refetchDetails: fetchDetails,
    loading,
    error,
    imdbData,
    imdbLoading,
    isWatchlisted,
    isWatched,
    userRating,
    handleRatingChange,
    userNotes,
    handleNotesChange,
    trackingData,
    handleToggleWatchlist,
    handleToggleWatched,
    mediaItemForLists
  };
};

export default useMediaDetailsCore;
