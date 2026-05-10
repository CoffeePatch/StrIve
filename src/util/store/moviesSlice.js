import { createSlice } from "@reduxjs/toolkit";

const moviesSlice = createSlice({
  name: "movies",
  initialState: {
    nowPlayingMovies: null,
    popularMovies: null,
    topRatedMovies: null,
    upcomingMovies: null,
    trailer: null, // <-- This was missing
    // store genre-specific lists keyed by genre id
    genreMovies: {},
  },
  reducers: {
    addNowPlayingMovies: (state, action) => {
      state.nowPlayingMovies = action.payload;
    },
    addPopularMovies: (state, action) => {
      state.popularMovies = action.payload;
    },
    addTopRatedMovies: (state, action) => {
      state.topRatedMovies = action.payload;
    },
    addUpcomingMovies: (state, action) => {
      state.upcomingMovies = action.payload;
    },
    // This reducer was missing
    addtrailer: (state, action) => {
      state.trailer = action.payload;
    },
    addGenreMovies: (state, action) => {
      const { genreId, results } = action.payload;
      if (!state.genreMovies) state.genreMovies = {};
      state.genreMovies[genreId] = results;
    },
  },
});

// We must also export the new 'addtrailer' action
export const {
  addNowPlayingMovies,
  addPopularMovies,
  addTopRatedMovies,
  addUpcomingMovies,
  addtrailer, // <-- This was missing
  addGenreMovies,
} = moviesSlice.actions;

export default moviesSlice.reducer;
