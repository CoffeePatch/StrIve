import { useEffect, useCallback } from "react";
import { addtrailer } from "../../util/store/moviesSlice";
import { useDispatch } from "react-redux";
import tmdbApiService from "../../services/tmdb/tmdbApiService";

const useMovieTrailer = (movieID) => {
  const dispatch = useDispatch();

  const getMovieVideos = useCallback(async () => {
    // A check to prevent errors if movieID is not available yet
    if (!movieID) return;

    const json = await tmdbApiService.get(`/movie/${movieID}/videos`, { language: 'en-US' });
    
    if (!json) return;
    
    // Check if results exist before trying to filter
    if (!json.results || !Array.isArray(json.results)) {
      console.error('Invalid response format or no results available');
      return;
    }
    
    const filterData = json.results.filter((video) => video.type === "Trailer");

    // If no trailer is found, take the first available video. Otherwise, use the first trailer.
    const trailer = filterData.length ? filterData[0] : json.results[0];
    dispatch(addtrailer(trailer));
  }, [dispatch, movieID]);

  // THE FIX: By adding [movieID], we tell React to re-run this code
  // every time the movieID changes.
  useEffect(() => {
    getMovieVideos();
  }, [movieID, getMovieVideos]);
};

export default useMovieTrailer;
