import { useDispatch, useSelector } from "react-redux";
import { options } from "../../util/core/constants";
import { addNowPlayingMovies } from "../../util/store/moviesSlice"; // Fixed import
import { useEffect, useCallback } from "react";

const useAddMovies = () => {
  const dispatch = useDispatch();
  const nowPlayingMovies = useSelector((state) => state.movies.nowPlayingMovies);

  const getmovies = useCallback(async () => {
    try {
      // Only fetch if we don't already have the data
      if (nowPlayingMovies && nowPlayingMovies.length > 0) return;
      
      const data = await fetch(
        "https://api.themoviedb.org/3/movie/now_playing?page=1",
        options
      );
      const json = await data.json();
      dispatch(addNowPlayingMovies(json.results)); // Fixed dispatch
    } catch (error) {
      console.error("Error fetching movies:", error);
    }
  }, [dispatch, nowPlayingMovies]);

  useEffect(() => {
    getmovies();
  }, [getmovies]); // Now we can safely include the function in dependencies
};

export default useAddMovies;
