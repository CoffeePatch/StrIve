**TV Show Details Page**
- Route `/shows/:tvId`; page component `TVShowDetailsPage` in [src/components/tv/TVShowDetailsPage.jsx](src/components/tv/TVShowDetailsPage.jsx); route wired in [src/components/layout/Body.jsx](src/components/layout/Body.jsx)
- App shell uses `Header` [src/components/layout/Header.jsx](src/components/layout/Header.jsx) and `Footer` [src/components/layout/Footer.jsx](src/components/layout/Footer.jsx)
- Hero/backdrop section includes full-bleed backdrop, gradients, poster card, title lockup, meta row, and action cluster in `TVShowDetailsPage`
- Content sections include overview, genre chips, cast rail, episodes module, and similar shows rail in `TVShowDetailsPage`
- Episodes module supports list, grid, and matrix layouts via `EpisodeListItem`, `EpisodeCard`, and `EpisodeMatrixView`
- List UI uses `AddToListPopover` [src/components/lists/AddToListPopover.jsx](src/components/lists/AddToListPopover.jsx) and `CreateListModal` [src/components/lists/CreateListModal.jsx](src/components/lists/CreateListModal.jsx)

**Data Sources**
- Show details via `useTvShowDetails` in [src/components/tv/TVShowDetailsPage.jsx](src/components/tv/TVShowDetailsPage.jsx)
- Episodes per season via `useTvSeasonEpisodes` in [src/components/tv/TVShowDetailsPage.jsx](src/components/tv/TVShowDetailsPage.jsx)
- Trailers via `useTvVideos` in [src/components/tv/TVShowDetailsPage.jsx](src/components/tv/TVShowDetailsPage.jsx)
- IMDb data via `useImdbTitle` in [src/components/tv/TVShowDetailsPage.jsx](src/components/tv/TVShowDetailsPage.jsx)
- Watchlist/watched state via `useLibraryItemStatus` in [src/components/tv/TVShowDetailsPage.jsx](src/components/tv/TVShowDetailsPage.jsx)
- Episode tracking via `useEpisodeStates`, `useMarkEpisodeWatched`, `useUnwatchSeries`, `useSeriesProgress`, and `useRecomputeSeriesProgress` in `TVShowDetailsPage`
- Cast list fetched from TMDB credits using `options` in `TVShowDetailsPage`
- List/status writes use helpers from [src/util/firebase/firestoreService.js](src/util/firebase/firestoreService.js)

**Interactions**
- Play Now opens the episode overlay with the first episode when available
- Trailer opens YouTube in a new tab
- Watchlist and Watched buttons call `setLibraryItemStatus` to toggle status
- Lists button opens `AddToListPopover`; create list opens `CreateListModal`
- Episode view toggle switches between list, grid, and matrix layouts via `EpisodeViewToggle` [src/components/tv/TVShowDetails/EpisodeViewToggle.jsx](src/components/tv/TVShowDetails/EpisodeViewToggle.jsx)
- Season tabs drive episode queries via `SeasonTabs` [src/components/media/SeasonTabs.jsx](src/components/media/SeasonTabs.jsx)
- Episode click opens `EpisodeOverlay` [src/components/tv/TVShowDetails/EpisodeOverlay.jsx](src/components/tv/TVShowDetails/EpisodeOverlay.jsx)
- Watch choice and unwatch confirmation modals manage bulk episode updates
- Progress bar reflects watched vs aired counts via `SeriesProgressBar` [src/components/media/SeriesProgressBar.jsx](src/components/media/SeriesProgressBar.jsx)
- Similar shows rail renders `SimilarShowsPanel` and `SimilarShowsCard` in [src/components/tv/TVShowDetails](src/components/tv/TVShowDetails)
- Toast messages confirm watch/unwatch operations
