import { useDispatch, useSelector } from "react-redux";
import { useEffect, useCallback, useMemo } from "react";
import { options } from "../../util/core/constants";
import { addUpcomingMovies } from "../../util/store/moviesSlice";
import { addOnTheAirTVShows } from "../../util/store/tvShowsSlice";
import { tmdbAdapter } from "../../domain/media";

const useUpcomingMedia = (mediaType) => {
  const dispatch = useDispatch();
  
  const rawData = useSelector((state) => 
    mediaType === "movie" 
      ? state.movies.upcomingMovies 
      : state.tvShows.onTheAirTVShows
  );

  const fetchMedia = useCallback(async () => {
    if (rawData && rawData.length > 0) return;
    
    try {
      const endpoint = mediaType === "movie" ? "movie/upcoming" : "tv/on_the_air";
      const response = await fetch(
        `https://api.themoviedb.org/3/${endpoint}?page=1`,
        options
      );
      const json = await response.json();
      
      if (mediaType === "movie") {
        dispatch(addUpcomingMovies(json.results));
      } else {
        dispatch(addOnTheAirTVShows(json.results));
      }
    } catch (error) {
      console.error(`Error fetching upcoming ${mediaType}:`, error);
    }
  }, [dispatch, mediaType, rawData]);

  useEffect(() => {
    fetchMedia();
  }, [fetchMedia]);

  const mediaList = useMemo(() => {
    if (!rawData) return null;
    return rawData
      .map(item => tmdbAdapter({ ...item, media_type: mediaType }))
      .filter(Boolean);
  }, [rawData, mediaType]);

  return mediaList;
};

export default useUpcomingMedia;
