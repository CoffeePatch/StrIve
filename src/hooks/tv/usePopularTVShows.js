import { useDispatch, useSelector } from "react-redux";
import { options } from "../../util/core/constants";
import { addPopularTVShows } from "../../util/store/tvShowsSlice";
import { useEffect, useCallback } from "react";

const usePopularTVShows = () => {
  const dispatch = useDispatch();
  const popularTVShows = useSelector((state) => state.tvShows.popularTVShows);

  const getPopularTVShows = useCallback(async () => {
    try {
      // Only fetch if we don't already have the data
      if (popularTVShows && popularTVShows.length > 0) return;
      
      const data = await fetch(
        "https://api.themoviedb.org/3/tv/popular?page=1",
        options
      );
      const json = await data.json();
      dispatch(addPopularTVShows(json.results));
    } catch (error) {
      console.error("Error fetching popular TV shows:", error);
    }
  }, [dispatch, popularTVShows]);

  useEffect(() => {
    getPopularTVShows();
  }, [getPopularTVShows]); // Now we can safely include the function in dependencies
};

export default usePopularTVShows;
