import { createSlice } from "@reduxjs/toolkit";

const userSlice = createSlice({
  name: "user",
  initialState: {
    user: null,
    // indicates whether auth state has been checked at least once
    initialized: false,
  },
  reducers: {
    login: (state, action) => {
      state.user = action.payload;
      state.initialized = true;
    },
    logout: (state) => {
      state.user = null;
      state.initialized = true;
    },
  },
});

export const { login, logout } = userSlice.actions;
export default userSlice.reducer;
