/**
 * SIMKL Redux Slice
 * Manages SIMKL authentication state and sync data
 */

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import simklAuthService from "../../services/simkl/simklAuthService";
import simklApiService from "../../services/simkl/simklApiService";

// Initial state
const initialState = {
  isAuthenticated: false,
  accessToken: null,
  lastSyncTimestamp: null,
  userProfile: null,
  syncStatus: "idle", // 'idle' | 'loading' | 'succeeded' | 'failed'
  syncError: null,
  activities: null,
  userStats: null,
  scrobbling: {
    active: false,
    currentMedia: null,
    lastScrobbleTime: null,
  },
};

// Async Thunks

/**
 * Initialize authentication from stored token
 */
export const initializeAuth = createAsyncThunk(
  "simkl/initializeAuth",
  async (_, { rejectWithValue }) => {
    try {
      const token = simklAuthService.getAccessToken();
      if (!token) {
        return { authenticated: false };
      }

      // Verify token by fetching user settings
      const userProfile = await simklApiService.getUserSettings();

      return {
        authenticated: true,
        accessToken: token,
        userProfile,
      };
    } catch (error) {
      // Token is invalid, clear it
      simklAuthService.clearToken();
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Exchange OAuth code for access token
 */
export const loginWithCode = createAsyncThunk(
  "simkl/loginWithCode",
  async (code, { rejectWithValue }) => {
    try {
      const result = await simklAuthService.exchangeCodeForToken(code);

      if (!result.success) {
        return rejectWithValue(result.error);
      }

      // Fetch user profile
      const userProfile = await simklApiService.getUserSettings();

      return {
        accessToken: result.accessToken,
        userProfile,
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Perform smart sync - check activities first, then sync if needed
 */
export const performSmartSync = createAsyncThunk(
  "simkl/performSmartSync",
  async (options = {}, { getState, rejectWithValue }) => {
    try {
      const { force = false } = options;
      const { simkl } = getState();

      // Step 1: Check activities
      const activities = await simklApiService.getActivities();

      // Step 2: Compare timestamps
      const lastSync = simkl.lastSyncTimestamp;
      const currentTimestamp = activities.all;

      // If timestamps match and not forced, no sync needed
      if (!force && lastSync && lastSync === currentTimestamp) {
        return {
          synced: false,
          message: "Already up to date",
          activities,
        };
      }

      // Step 3: Sync is needed - fetch delta or full data
      // If forced, pass null to ensure we get ALL items, not just changes since lastSync
      const allItems = await simklApiService.getAllItems(
        force ? null : lastSync
      );

      return {
        synced: true,
        activities,
        data: allItems,
        timestamp: currentTimestamp,
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Mark items as watched
 */
export const markAsWatched = createAsyncThunk(
  "simkl/markAsWatched",
  async (items, { rejectWithValue }) => {
    try {
      const result = await simklApiService.pushHistory(items);
      return result;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Start scrobbling
 */
export const startScrobble = createAsyncThunk(
  "simkl/startScrobble",
  async (mediaInfo, { getState, rejectWithValue }) => {
    try {
      const { simkl } = getState();
      const now = Date.now();

      // Prevent scrobbling more than once per 20 seconds
      if (
        simkl.scrobbling.lastScrobbleTime &&
        now - simkl.scrobbling.lastScrobbleTime < 20000
      ) {
        return { throttled: true };
      }

      await simklApiService.scrobbleStart(mediaInfo);

      return {
        mediaInfo,
        timestamp: now,
      };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Stop scrobbling
 */
export const stopScrobble = createAsyncThunk(
  "simkl/stopScrobble",
  async (mediaInfo, { rejectWithValue }) => {
    try {
      await simklApiService.scrobbleStop(mediaInfo);
      return { stopped: true };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

/**
 * Fetch user statistics
 */
export const fetchUserStats = createAsyncThunk(
  "simkl/fetchUserStats",
  async (_, { rejectWithValue }) => {
    try {
      const stats = await simklApiService.getUserStats();
      return stats;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// Slice
const simklSlice = createSlice({
  name: "simkl",
  initialState,
  reducers: {
    logout: () => {
      simklAuthService.logout();
      return initialState;
    },
    clearSyncError: (state) => {
      state.syncError = null;
    },
    updateLastSyncTimestamp: (state, action) => {
      state.lastSyncTimestamp = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      // Initialize Auth
      .addCase(initializeAuth.fulfilled, (state, action) => {
        if (action.payload.authenticated) {
          state.isAuthenticated = true;
          state.accessToken = action.payload.accessToken;
          state.userProfile = action.payload.userProfile;
        }
      })
      .addCase(initializeAuth.rejected, (state) => {
        state.isAuthenticated = false;
        state.accessToken = null;
      })

      // Login with Code
      .addCase(loginWithCode.pending, (state) => {
        state.syncStatus = "loading";
      })
      .addCase(loginWithCode.fulfilled, (state, action) => {
        state.isAuthenticated = true;
        state.accessToken = action.payload.accessToken;
        state.userProfile = action.payload.userProfile;
        state.syncStatus = "succeeded";
      })
      .addCase(loginWithCode.rejected, (state, action) => {
        state.syncStatus = "failed";
        state.syncError = action.payload;
      })

      // Smart Sync
      .addCase(performSmartSync.pending, (state) => {
        state.syncStatus = "loading";
        state.syncError = null;
      })
      .addCase(performSmartSync.fulfilled, (state, action) => {
        state.syncStatus = "succeeded";
        state.activities = action.payload.activities;

        if (action.payload.synced) {
          state.lastSyncTimestamp = action.payload.timestamp;
        }
      })
      .addCase(performSmartSync.rejected, (state, action) => {
        state.syncStatus = "failed";
        state.syncError = action.payload;
      })

      // Mark as Watched
      .addCase(markAsWatched.fulfilled, (state) => {
        // Trigger a re-sync after marking as watched
        state.lastSyncTimestamp = null;
      })

      // Start Scrobble
      .addCase(startScrobble.fulfilled, (state, action) => {
        if (!action.payload.throttled) {
          state.scrobbling.active = true;
          state.scrobbling.currentMedia = action.payload.mediaInfo;
          state.scrobbling.lastScrobbleTime = action.payload.timestamp;
        }
      })

      // Stop Scrobble
      .addCase(stopScrobble.fulfilled, (state) => {
        state.scrobbling.active = false;
        state.scrobbling.currentMedia = null;
      })

      // Fetch User Stats
      .addCase(fetchUserStats.fulfilled, (state, action) => {
        state.userStats = action.payload;
      });
  },
});

export const { logout, clearSyncError, updateLastSyncTimestamp } =
  simklSlice.actions;

// Selectors
export const selectIsAuthenticated = (state) => state.simkl.isAuthenticated;
export const selectSyncStatus = (state) => state.simkl.syncStatus;
export const selectUserProfile = (state) => state.simkl.userProfile;
export const selectUserStats = (state) => state.simkl.userStats;
export const selectScrobbling = (state) => state.simkl.scrobbling;
export const selectLastSyncTimestamp = (state) => state.simkl.lastSyncTimestamp;

export default simklSlice.reducer;
