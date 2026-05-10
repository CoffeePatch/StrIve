import { useDispatch, useSelector } from "react-redux";
import { options } from "../../util/constants";
import { addTopRatedTVShows } from "../../util/tvShowsSlice";
import { useEffect, useCallback } from "react";

const useTopRatedTVShows = () => {
  const dispatch = useDispatch();
  const topRatedTVShows = useSelector((state) => state.tvShows.topRatedTVShows);

  const getTopRatedTVShows = useCallback(async () => {
    try {
      // Only fetch if we don't already have the data
      if (topRatedTVShows && topRatedTVShows.length > 0) return;
      
      const data = await fetch(
        "https://api.themoviedb.org/3/tv/top_rated?page=1",
        options
      );
      const json = await data.json();
      dispatch(addTopRatedTVShows(json.results));
    } catch (error) {
      console.error("Error fetching top rated TV shows:", error);
    }
  }, [dispatch, topRatedTVShows]);

  useEffect(() => {
    getTopRatedTVShows();
  }, [getTopRatedTVShows]); // Now we can safely include the function in dependencies
};

export default useTopRatedTVShows;
