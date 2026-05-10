import { useDispatch, useSelector } from "react-redux";
import { options } from "../../util/constants";
import { addGenreTVShows } from "../../util/tvShowsSlice";
import { useEffect, useCallback } from "react";

const useTVShowsByGenre = (genreId) => {
  const dispatch = useDispatch();
  const genreShows = useSelector((state) => state.tvShows.genreTVShows?.[genreId]);

  const getShows = useCallback(async () => {
    if (genreShows && genreShows.length > 0) return;
    const data = await fetch(
      `https://api.themoviedb.org/3/discover/tv?with_genres=${genreId}&page=1`,
      options
    );
    const json = await data.json();
    dispatch(addGenreTVShows({ genreId, results: json.results }));
  }, [dispatch, genreId, genreShows]);

  useEffect(() => {
    getShows();
  }, [getShows]);
};

export default useTVShowsByGenre;
