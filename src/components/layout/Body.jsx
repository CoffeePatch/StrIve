import { createBrowserRouter, Navigate } from "react-router-dom";
import { Outlet, useLocation } from "react-router-dom";
import { useLayoutEffect } from "react";
import Browse from "../pages/Browse";
import Login from "../auth/Login";
import TVShows from "../tv/TVShows";
import MoviesPage from "../movie/Listing/MoviesPage";
import MovieDetails from "../movie/MovieDetails/MovieDetails";
import TVShowDetailsPage from "../tv/TVShowDetailsPage";
import SearchPage from "../pages/SearchPage";
import ProfilePage from "../pages/ProfilePage";
import ProtectedRoute from "./ProtectedRoute";
import ImportPage from "../import/ImportPage";
import ImportReviewPage from "../import/ImportReviewPage";
import LibraryMasterPage from "../library/LibraryMasterPage";
import SettingsPage from "../settings/SettingsPage";
import SimklPage from "../simkl/SimklPage";
import SimklCallback from "../simkl/SimklCallback";
import { useSimklBackgroundSync } from "../../hooks/simkl/useSimkl";
import { RouterProvider } from "react-router-dom";
import Footer from "./Footer";

const ScrollToTop = () => {
  const location = useLocation();

  useLayoutEffect(() => {
    // Only scroll on pathname changes, ignore hash and search
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.pathname]);

  return null;
};

import BottomNav from "./BottomNav";

const AppLayout = () => (
  <div className="pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
    <ScrollToTop />
    <Outlet />
    <BottomNav />
  </div>
);

const Body = () => {
  useSimklBackgroundSync(); // Enable background sync globally

  const appRouter = createBrowserRouter([
    {
      element: <AppLayout />,
      children: [
        {
          path: "/",
          element: <Browse />,
        },
        {
          path: "/login",
          element: <Login />,
        },
        {
          path: "/movies",
          element: (
            <ProtectedRoute>
              <MoviesPage />
            </ProtectedRoute>
          ),
        },
        {
          path: "/shows",
          element: (
            <ProtectedRoute>
              <TVShows />
            </ProtectedRoute>
          ),
        },
        {
          path: "/search",
          element: (
            <ProtectedRoute>
              <SearchPage />
            </ProtectedRoute>
          ),
        },
        {
          path: "/library",
          element: (
            <ProtectedRoute>
              <LibraryMasterPage />
            </ProtectedRoute>
          ),
        },
        {
          path: "/settings",
          element: (
            <ProtectedRoute>
              <SettingsPage />
            </ProtectedRoute>
          ),
        },
        {
          path: "/import", // Import CSV page
          element: (
            <ProtectedRoute>
              <ImportPage />
            </ProtectedRoute>
          ),
        },
        {
          path: "/import/review", // Import review page
          element: (
            <ProtectedRoute>
              <ImportReviewPage />
            </ProtectedRoute>
          ),
        },
        {
          path: "/simkl",
          element: (
            <ProtectedRoute>
              <SimklPage />
            </ProtectedRoute>
          ),
        },
        {
          path: "/simkl/callback",
          element: <SimklCallback />,
        },
        {
          path: "/movie/:movieId",
          element: (
            <ProtectedRoute>
              <MovieDetails />
            </ProtectedRoute>
          ),
        },

        {
          path: "/shows/:tvId",
          element: (
            <ProtectedRoute>
              <TVShowDetailsPage />
            </ProtectedRoute>
          ),
        },
        {
          path: "/profile",
          element: (
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          ),
        },
      ],
    },
  ]);

  return (
    <div className="min-h-screen flex flex-col">
      <div className="flex-1">
        <RouterProvider router={appRouter} />
      </div>
      <Footer />
    </div>
  );
};

export default Body;

