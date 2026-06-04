import { useDispatch, useSelector } from "react-redux";
import { useEffect, useCallback, useMemo } from "react";
import { options } from "../../util/core/constants";
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
      const response = await fetch(
        `https://api.themoviedb.org/3/${mediaType}/top_rated?page=1`,
        options
      );
      const json = await response.json();
      
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
