import { useDispatch, useSelector } from "react-redux";
import { useEffect, useCallback, useMemo } from "react";
import { options } from "../../util/core/constants";
import { addPopularMovies } from "../../util/store/moviesSlice";
import { addPopularTVShows } from "../../util/store/tvShowsSlice";
import { tmdbAdapter } from "../../domain/media";

const usePopularMedia = (mediaType) => {
  const dispatch = useDispatch();
  
  const rawData = useSelector((state) => 
    mediaType === "movie" 
      ? state.movies.popularMovies 
      : state.tvShows.popularTVShows
  );

  const fetchMedia = useCallback(async () => {
    if (rawData && rawData.length > 0) return;
    
    try {
      const response = await fetch(
        `https://api.themoviedb.org/3/${mediaType}/popular?page=1`,
        options
      );
      const json = await response.json();
      
      if (mediaType === "movie") {
        dispatch(addPopularMovies(json.results));
      } else {
        dispatch(addPopularTVShows(json.results));
      }
    } catch (error) {
      console.error(`Error fetching popular ${mediaType}:`, error);
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

export default usePopularMedia;
