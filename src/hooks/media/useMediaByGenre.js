import { useDispatch, useSelector } from "react-redux";
import { useEffect, useCallback, useMemo } from "react";
import tmdbApiService from "../../services/tmdb/tmdbApiService";
import { addGenreMovies } from "../../util/store/moviesSlice";
import { addGenreTVShows } from "../../util/store/tvShowsSlice";
import { tmdbAdapter } from "../../domain/media";

const useMediaByGenre = (mediaType, genreId) => {
  const dispatch = useDispatch();
  
  const rawData = useSelector((state) => 
    mediaType === "movie" 
      ? state.movies.genreMovies?.[genreId]
      : state.tvShows.genreTVShows?.[genreId]
  );

  const fetchMedia = useCallback(async () => {
    if (rawData && rawData.length > 0) return;
    
    try {
      const json = await tmdbApiService.get(`/discover/${mediaType}`, {
        with_genres: genreId,
        page: 1
      });
      
      if (!json) return;
      
      if (mediaType === "movie") {
        dispatch(addGenreMovies({ genreId, results: json.results }));
      } else {
        dispatch(addGenreTVShows({ genreId, results: json.results }));
      }
    } catch (error) {
      console.error(`Error fetching ${mediaType} by genre ${genreId}:`, error);
    }
  }, [dispatch, mediaType, genreId, rawData]);

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

export default useMediaByGenre;
