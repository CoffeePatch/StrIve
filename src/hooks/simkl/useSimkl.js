/**
 * SIMKL React Hooks
 * Custom hooks for SIMKL integration in React components
 */

import { useEffect, useCallback, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  initializeAuth,
  loginWithCode,
  performSmartSync,
  markAsWatched,
  startScrobble,
  stopScrobble,
  fetchUserStats,
  logout,
  selectIsAuthenticated,
  selectSyncStatus,
  selectUserProfile,
  selectUserStats,
  selectScrobbling,
} from "../../util/store/simklSlice";
import simklAuthService from "../../services/simkl/simklAuthService";

/**
 * Main SIMKL hook - provides authentication and sync functionality
 */
export const useSimkl = () => {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const syncStatus = useSelector(selectSyncStatus);
  const userProfile = useSelector(selectUserProfile);
  const userStats = useSelector(selectUserStats);

  // Initialize auth on mount
  useEffect(() => {
    dispatch(initializeAuth());
  }, [dispatch]);

  const login = useCallback(() => {
    simklAuthService.initiateAuth();
  }, []);

  const handleCallback = useCallback(
    (code) => {
      return dispatch(loginWithCode(code));
    },
    [dispatch]
  );

  const sync = useCallback(
    (options) => {
      return dispatch(performSmartSync(options));
    },
    [dispatch]
  );

  const logoutUser = useCallback(() => {
    dispatch(logout());
  }, [dispatch]);

  const getStats = useCallback(() => {
    return dispatch(fetchUserStats());
  }, [dispatch]);

  return {
    isAuthenticated,
    syncStatus,
    userProfile,
    userStats,
    login,
    handleCallback,
    sync,
    logout: logoutUser,
    getStats,
  };
};

/**
 * Hook for scrobbling functionality in video players
 * Automatically handles start/stop scrobbling based on playback
 */
export const useSimklScrobble = (mediaInfo) => {
  const dispatch = useDispatch();
  const scrobbling = useSelector(selectScrobbling);
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const start = useCallback(() => {
    if (!isAuthenticated || !mediaInfo) return;

    dispatch(startScrobble(mediaInfo));
  }, [dispatch, isAuthenticated, mediaInfo]);

  const stop = useCallback(
    (progress = 0) => {
      if (!isAuthenticated || !mediaInfo) return;

      const mediaWithProgress = {
        ...mediaInfo,
        progress,
      };

      dispatch(stopScrobble(mediaWithProgress));
    },
    [dispatch, isAuthenticated, mediaInfo]
  );

  return {
    start,
    stop,
    isScrobbling: scrobbling.active,
    currentMedia: scrobbling.currentMedia,
  };
};

/**
 * Hook for marking items as watched
 */
export const useSimklWatched = () => {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);

  const markWatched = useCallback(
    (items) => {
      if (!isAuthenticated) {
        console.warn("User not authenticated with SIMKL");
        return;
      }

      return dispatch(markAsWatched(items));
    },
    [dispatch, isAuthenticated]
  );

  return {
    markWatched,
    isAuthenticated,
  };
};

/**
 * Hook for background sync on app focus
 * Implements the recommendation to sync when app gains focus
 */
export const useSimklBackgroundSync = () => {
  const dispatch = useDispatch();
  const isAuthenticated = useSelector(selectIsAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) return;

    // DISABLED: Background sync on focus has been detached to reduce unnecessary API calls
    // Uncomment to re-enable this feature
    // const handleFocus = () => {
    //   console.log("App focused - checking for SIMKL updates...");
    //   dispatch(performSmartSync());
    // };
    //
    // window.addEventListener("focus", handleFocus);
    //
    // return () => {
    //   window.removeEventListener("focus", handleFocus);
    // };
  }, [dispatch, isAuthenticated]);
};

/**
 * Hook for SIMKL OAuth callback handling
 * Use this on your callback page
 */
export const useSimklCallback = () => {
  const dispatch = useDispatch();
  const processedRef = useRef(false);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get("code");
    const error = urlParams.get("error");

    if (error) {
      console.error("SIMKL OAuth error:", error);
      return;
    }

    if (code && !processedRef.current) {
      processedRef.current = true; // Mark as processed immediately
      dispatch(loginWithCode(code)).then((result) => {
        if (result.meta.requestStatus === "fulfilled") {
          // Success - component will handle redirect
        }
      });
    }
  }, [dispatch]);
};
