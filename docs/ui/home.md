**Home (Browse)**
- Route `/`; page component `Browse` in [src/components/pages/Browse.jsx](src/components/pages/Browse.jsx); route wired in [src/components/layout/Body.jsx](src/components/layout/Body.jsx)
- App shell uses `Header` [src/components/layout/Header.jsx](src/components/layout/Header.jsx) and `Footer` [src/components/layout/Footer.jsx](src/components/layout/Footer.jsx)
- Hero spotlight is `MainContainer` [src/components/layout/MainContainer.jsx](src/components/layout/MainContainer.jsx) with `PosterBackground` [src/components/media/PosterBackground.jsx](src/components/media/PosterBackground.jsx) and `PosterTitle` [src/components/media/PosterTitle.jsx](src/components/media/PosterTitle.jsx)
- Media rails are `MediaList` rows inside `Browse` for popular/top/upcoming plus genre buckets, rendered as horizontal carousels
- Rail items render `MovieCard` [src/components/movie/Cards/MovieCard.jsx](src/components/movie/Cards/MovieCard.jsx) with mixed movie/TV metadata

**Data Sources**
- Movie hooks: `useAddMovies`, `usePopularMovies`, `useTopRatedMovies`, `useUpcomingMovies`, `useMoviesByGenre` in [src/components/pages/Browse.jsx](src/components/pages/Browse.jsx)
- TV hooks: `usePopularTVShows`, `useTopRatedTVShows`, `useOnTheAirTVShows`, `useTVShowsByGenre` in [src/components/pages/Browse.jsx](src/components/pages/Browse.jsx)
- Store reads: `movies` and `tvShows` slices via `useSelector` in [src/components/pages/Browse.jsx](src/components/pages/Browse.jsx)
- Hero selection chooses a random now-playing movie from the store in `MainContainer` [src/components/layout/MainContainer.jsx](src/components/layout/MainContainer.jsx)

**Interactions**
- Hero actions in `PosterTitle` trigger play, view details, and add-to-watchlist flows in [src/components/media/PosterTitle.jsx](src/components/media/PosterTitle.jsx)
- Card clicks route to `/movie/:id` or `/shows/:id` in `MovieCard` [src/components/movie/Cards/MovieCard.jsx](src/components/movie/Cards/MovieCard.jsx)
- Rails are horizontal scroll containers with wheel-to-horizontal support in [src/App.jsx](src/App.jsx)
- Header nav and search entry points come from `Header` [src/components/layout/Header.jsx](src/components/layout/Header.jsx)
