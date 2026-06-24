import { useDispatch, useSelector } from "react-redux";
import { useEffect, useCallback, useMemo, useRef } from "react";
import tmdbApiService from "../../services/tmdb/tmdbApiService";
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

  const rawDataRef = useRef(rawData);
  rawDataRef.current = rawData;

  const fetchMedia = useCallback(async () => {
    if (rawDataRef.current && rawDataRef.current.length > 0) return;
    
    try {
      const endpoint = mediaType === "movie" ? "trending/movie/day" : `${mediaType}/popular`;
      const json = await tmdbApiService.get(`/${endpoint}`, { page: 1 });
      
      if (!json) return;
      
      if (mediaType === "movie") {
        dispatch(addPopularMovies(json.results));
      } else {
        dispatch(addPopularTVShows(json.results));
      }
    } catch (error) {
      console.error(`Error fetching popular ${mediaType}:`, error);
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

export default usePopularMedia;
