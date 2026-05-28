**Movies Page**
- Route `/movies`; page component `MoviesPage` in [src/components/movie/Listing/MoviesPage.jsx](src/components/movie/Listing/MoviesPage.jsx); route wired in [src/components/layout/Body.jsx](src/components/layout/Body.jsx)
- App shell uses `Header` [src/components/layout/Header.jsx](src/components/layout/Header.jsx) and `Footer` [src/components/layout/Footer.jsx](src/components/layout/Footer.jsx)
- Hero banner with icon, title, and description sits at the top of `MoviesPage`
- Movie rails are `MovieList` rows for Popular, Top Rated, Upcoming, Action, Adventure, Romance
- Rail items use `MovieCard` [src/components/movie/Cards/MovieCard.jsx](src/components/movie/Cards/MovieCard.jsx)

**Data Sources**
- Hooks: `usePopularMovies`, `useTopRatedMovies`, `useUpcomingMovies`, `useMoviesByGenre` in [src/components/movie/Listing/MoviesPage.jsx](src/components/movie/Listing/MoviesPage.jsx)
- Store reads: `movies` slice via `useSelector` in [src/components/movie/Listing/MoviesPage.jsx](src/components/movie/Listing/MoviesPage.jsx)
- Genre buckets map to TMDB ids 28, 12, 10749 in `MoviesPage`
- Card data passes through from TMDB results into `MovieCard`

**Interactions**
- Card click routes to `/movie/:id` in `MovieCard` [src/components/movie/Cards/MovieCard.jsx](src/components/movie/Cards/MovieCard.jsx)
- Horizontal rail scrolling via overflow-x lists in `MoviesPage`
- Header nav and search entry points from `Header` [src/components/layout/Header.jsx](src/components/layout/Header.jsx)
- No inline filters or search on this page (browse-only layout)
