import { useDispatch, useSelector } from "react-redux";
import { options } from "../../util/constants";
import { addOnTheAirTVShows } from "../../util/tvShowsSlice";
import { useEffect, useCallback } from "react";

const useOnTheAirTVShows = () => {
  const dispatch = useDispatch();
  const onTheAirTVShows = useSelector((state) => state.tvShows.onTheAirTVShows);

  const getOnTheAirTVShows = useCallback(async () => {
    try {
      // Only fetch if we don't already have the data
      if (onTheAirTVShows && onTheAirTVShows.length > 0) return;
      
      const data = await fetch(
        "https://api.themoviedb.org/3/tv/on_the_air?page=1",
        options
      );
      const json = await data.json();
      dispatch(addOnTheAirTVShows(json.results));
    } catch (error) {
      console.error("Error fetching on the air TV shows:", error);
    }
  }, [dispatch, onTheAirTVShows]);

  useEffect(() => {
    getOnTheAirTVShows();
  }, [getOnTheAirTVShows]); // Now we can safely include the function in dependencies
};

export default useOnTheAirTVShows;
