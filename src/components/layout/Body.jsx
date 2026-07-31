import { lazy, Suspense, useLayoutEffect } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { Outlet, useLocation, useOutlet } from "react-router-dom";
import PageLoader from "../ui/PageLoader";

// Eagerly loaded components (Core Navigation)
import Browse from "../pages/Browse";
import Login from "../auth/Login";
import TVShows from "../tv/TVShows";
import MoviesPage from "../movie/Listing/MoviesPage";
import SearchPage from "../pages/SearchPage";

// Lazily loaded components (Secondary/Detailed screens)
const LibraryMasterPage = lazy(() => import("../library/LibraryMasterPage"));
const MovieDetails = lazy(() => import("../movie/MovieDetails/MovieDetails"));
const TVShowDetailsPage = lazy(() => import("../tv/TVShowDetailsPage"));
const SettingsPage = lazy(() => import("../settings/SettingsPage"));
const ImportPage = lazy(() => import("../import/ImportPage"));
const ImportReviewPage = lazy(() => import("../import/ImportReviewPage"));
const SimklPage = lazy(() => import("../simkl/SimklPage"));
const SimklCallback = lazy(() => import("../simkl/SimklCallback"));
const ProfilePage = lazy(() => import("../pages/ProfilePage"));

import ProtectedRoute from "./ProtectedRoute";
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

const AppLayout = () => {
  const element = useOutlet();
  
  return (
    <div className="pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0">
      <ScrollToTop />
      <Suspense fallback={<PageLoader />}>
        {element}
      </Suspense>
      <BottomNav />
    </div>
  );
};

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

