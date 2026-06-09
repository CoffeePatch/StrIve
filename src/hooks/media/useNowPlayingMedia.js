import { useDispatch, useSelector } from "react-redux";
import { useEffect, useCallback, useMemo } from "react";
import tmdbApiService from "../../services/tmdb/tmdbApiService";
import { addNowPlayingMovies } from "../../util/store/moviesSlice";
import { addAiringTodayTVShows } from "../../util/store/tvShowsSlice";
import { tmdbAdapter } from "../../domain/media";

const useNowPlayingMedia = (mediaType) => {
  const dispatch = useDispatch();
  
  const rawData = useSelector((state) => 
    mediaType === "movie" 
      ? state.movies.nowPlayingMovies 
      : state.tvShows.airingTodayTVShows
  );

  const fetchMedia = useCallback(async () => {
    if (rawData && rawData.length > 0) return;
    
    try {
      const endpoint = mediaType === "movie" ? "movie/now_playing" : "tv/airing_today";
      const json = await tmdbApiService.get(`/${endpoint}`, { page: 1 });
      
      if (!json) return;
      
      if (mediaType === "movie") {
        dispatch(addNowPlayingMovies(json.results));
      } else {
        dispatch(addAiringTodayTVShows(json.results));
      }
    } catch (error) {
      console.error(`Error fetching now_playing/airing_today ${mediaType}:`, error);
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

export default useNowPlayingMedia;
