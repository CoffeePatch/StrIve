**Shows Page**
- Route `/shows`; page component `TVShows` in [src/components/tv/TVShows.jsx](src/components/tv/TVShows.jsx); route wired in [src/components/layout/Body.jsx](src/components/layout/Body.jsx)
- App shell uses `Header` [src/components/layout/Header.jsx](src/components/layout/Header.jsx) and `Footer` [src/components/layout/Footer.jsx](src/components/layout/Footer.jsx)
- Hero banner with icon, title, and description sits at the top of `TVShows`
- TV rails are `TVShowList` rows for On The Air, Popular, Top Rated, Action & Adventure, Comedy, Romance
- Rail items use `TVShowCard` [src/components/tv/TVShowCard.jsx](src/components/tv/TVShowCard.jsx)

**Data Sources**
- Hooks: `usePopularTVShows`, `useTopRatedTVShows`, `useOnTheAirTVShows`, `useTVShowsByGenre` in [src/components/tv/TVShows.jsx](src/components/tv/TVShows.jsx)
- Store reads: `tvShows` slice via `useSelector` in [src/components/tv/TVShows.jsx](src/components/tv/TVShows.jsx)
- Genre buckets map to TMDB ids 10759, 35, 10749 in `TVShows`
- Card data passes through from TMDB results into `TVShowCard`

**Interactions**
- Card click routes to `/shows/:id` in `TVShowCard` [src/components/tv/TVShowCard.jsx](src/components/tv/TVShowCard.jsx)
- Horizontal rail scrolling via overflow-x lists in `TVShows`
- Header nav and search entry points from `Header` [src/components/layout/Header.jsx](src/components/layout/Header.jsx)
- No inline filters or search on this page (browse-only layout)
