import { useDispatch, useSelector } from "react-redux";
import { options } from "../../util/core/constants";
import { addGenreMovies } from "../../util/store/moviesSlice";
import { useEffect, useCallback } from "react";

const useMoviesByGenre = (genreId) => {
  const dispatch = useDispatch();
  const genreMovies = useSelector((state) => state.movies.genreMovies?.[genreId]);

  const getMovies = useCallback(async () => {
    if (genreMovies && genreMovies.length > 0) return;
    const data = await fetch(
      `https://api.themoviedb.org/3/discover/movie?with_genres=${genreId}&page=1`,
      options
    );
    const json = await data.json();
    dispatch(addGenreMovies({ genreId, results: json.results }));
  }, [dispatch, genreId, genreMovies]);

  useEffect(() => {
    getMovies();
  }, [getMovies]);
};

export default useMoviesByGenre;
