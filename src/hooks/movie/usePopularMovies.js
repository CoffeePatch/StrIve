import { useDispatch, useSelector } from "react-redux";
import { options } from "../../util/core/constants";
import { addPopularMovies } from "../../util/store/moviesSlice";
import { useEffect, useCallback } from "react";

const usePopularMovies = () => {
  const dispatch = useDispatch();
  const popularMovies = useSelector((state) => state.movies.popularMovies);

  const getPopularMovies = useCallback(async () => {
    // Only fetch if we don't already have the data
    if (popularMovies && popularMovies.length > 0) return;
    
    const data = await fetch(
      "https://api.themoviedb.org/3/movie/popular?page=1",
      options
    );
    const json = await data.json();
    dispatch(addPopularMovies(json.results));
  }, [dispatch, popularMovies]);

  useEffect(() => {
    getPopularMovies();
  }, [getPopularMovies]); // Now we can safely include the function in dependencies
};

export default usePopularMovies;
