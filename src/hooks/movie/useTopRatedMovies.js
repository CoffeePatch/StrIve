import { useDispatch, useSelector } from "react-redux";
import { options } from "../../util/constants";
import { addTopRatedMovies } from "../../util/moviesSlice";
import { useEffect, useCallback } from "react";

const useTopRatedMovies = () => {
  const dispatch = useDispatch();
  const topRatedMovies = useSelector((state) => state.movies.topRatedMovies);

  const getTopRatedMovies = useCallback(async () => {
    // Only fetch if we don't already have the data
    if (topRatedMovies && topRatedMovies.length > 0) return;
    
    const data = await fetch(
      "https://api.themoviedb.org/3/movie/top_rated?page=1",
      options
    );
    const json = await data.json();
    dispatch(addTopRatedMovies(json.results));
  }, [dispatch, topRatedMovies]);

  useEffect(() => {
    getTopRatedMovies();
  }, [getTopRatedMovies]); // Now we can safely include the function in dependencies
};

export default useTopRatedMovies;
