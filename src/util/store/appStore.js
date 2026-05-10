import { configureStore } from "@reduxjs/toolkit";
import userReducer from "./userSlice";
import moviesReducer from "./moviesSlice";
import tvShowsReducer from "./tvShowsSlice";
import listsReducer from "./listsSlice";
import simklReducer from "./simklSlice";

const appStore = configureStore({
  reducer: {
    user: userReducer,
    movies: moviesReducer,
    tvShows: tvShowsReducer,
    lists: listsReducer,
    simkl: simklReducer,
  },
});

export default appStore;
