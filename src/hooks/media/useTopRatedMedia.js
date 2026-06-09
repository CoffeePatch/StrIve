import { useDispatch, useSelector } from "react-redux";
import { useEffect, useCallback, useMemo } from "react";
import tmdbApiService from "../../services/tmdb/tmdbApiService";
import { addTopRatedMovies } from "../../util/store/moviesSlice";
import { addTopRatedTVShows } from "../../util/store/tvShowsSlice";
import { tmdbAdapter } from "../../domain/media";

const useTopRatedMedia = (mediaType) => {
  const dispatch = useDispatch();
  
  const rawData = useSelector((state) => 
    mediaType === "movie" 
      ? state.movies.topRatedMovies 
      : state.tvShows.topRatedTVShows
  );

  const fetchMedia = useCallback(async () => {
    if (rawData && rawData.length > 0) return;
    
    try {
      const json = await tmdbApiService.get(`/${mediaType}/top_rated`, { page: 1 });
      
      if (!json) return;
      
      if (mediaType === "movie") {
        dispatch(addTopRatedMovies(json.results));
      } else {
        dispatch(addTopRatedTVShows(json.results));
      }
    } catch (error) {
      console.error(`Error fetching top rated ${mediaType}:`, error);
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

export default useTopRatedMedia;
