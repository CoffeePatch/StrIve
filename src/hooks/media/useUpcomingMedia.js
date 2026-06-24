import { useDispatch, useSelector } from "react-redux";
import { useEffect, useCallback, useMemo, useRef } from "react";
import tmdbApiService from "../../services/tmdb/tmdbApiService";
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

  const rawDataRef = useRef(rawData);
  rawDataRef.current = rawData;

  const fetchMedia = useCallback(async () => {
    if (rawDataRef.current && rawDataRef.current.length > 0) return;
    
    try {
      const endpoint = mediaType === "movie" ? "movie/upcoming" : "tv/on_the_air";
      const json = await tmdbApiService.get(`/${endpoint}`, { page: 1 });
      
      if (!json) return;
      
      if (mediaType === "movie") {
        dispatch(addUpcomingMovies(json.results));
      } else {
        dispatch(addOnTheAirTVShows(json.results));
      }
    } catch (error) {
      console.error(`Error fetching upcoming ${mediaType}:`, error);
    }
  }, [dispatch, mediaType]);

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
