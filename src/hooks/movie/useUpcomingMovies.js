import { useDispatch, useSelector } from "react-redux";
import { options } from "../../util/core/constants";
import { addUpcomingMovies } from "../../util/store/moviesSlice";
import { useEffect, useCallback } from "react";

const useUpcomingMovies = () => {
  const dispatch = useDispatch();
  const upcomingMovies = useSelector((state) => state.movies.upcomingMovies);

  const getUpcomingMovies = useCallback(async () => {
    // Only fetch if we don't already have the data
    if (upcomingMovies && upcomingMovies.length > 0) return;
    
    const data = await fetch(
      "https://api.themoviedb.org/3/movie/upcoming?page=1",
      options
    );
    const json = await data.json();
    dispatch(addUpcomingMovies(json.results));
  }, [dispatch, upcomingMovies]);

  useEffect(() => {
    getUpcomingMovies();
  }, [getUpcomingMovies]); // Now we can safely include the function in dependencies
};

export default useUpcomingMovies;
