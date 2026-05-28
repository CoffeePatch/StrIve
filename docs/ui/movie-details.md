**Movie Details Page**
- Route `/movie/:movieId`; page component `MovieDetails` in [src/components/movie/MovieDetails/MovieDetails.jsx](src/components/movie/MovieDetails/MovieDetails.jsx); route wired in [src/components/layout/Body.jsx](src/components/layout/Body.jsx)
- App shell uses `Header` [src/components/layout/Header.jsx](src/components/layout/Header.jsx) and `Footer` [src/components/layout/Footer.jsx](src/components/layout/Footer.jsx)
- Hero/backdrop section includes full-bleed backdrop, gradients, title lockup, meta row, and action cluster in `MovieDetails`
- Content sections include overview, genre chips, cast rail, and similar movies grid in `MovieDetails`
- List UI uses `AddToListPopover` [src/components/lists/AddToListPopover.jsx](src/components/lists/AddToListPopover.jsx) and `CreateListModal` [src/components/lists/CreateListModal.jsx](src/components/lists/CreateListModal.jsx)

**Data Sources**
- TMDB detail fetch uses `append_to_response=images,credits,similar,videos` in `MovieDetails`
- IMDb data comes from `useImdbTitle` [src/hooks/media/useImdbTitle.js](src/hooks/media/useImdbTitle.js)
- Auth gate uses `useRequireAuth` [src/hooks/common/useRequireAuth.js](src/hooks/common/useRequireAuth.js)
- Watchlist/watched state hydrates via `useLibraryItemStatus` [src/hooks/media/useLibraryItemStatus.js](src/hooks/media/useLibraryItemStatus.js)
- List and status writes use helpers from [src/util/firebase/firestoreService.js](src/util/firebase/firestoreService.js)

**Interactions**
- Play button and Trailer link live in the hero action cluster in `MovieDetails`
- Watchlist and Watched buttons call `setLibraryItemStatus` to toggle status
- Lists button opens `AddToListPopover`; create list opens `CreateListModal`
- Similar movies grid cards navigate to another movie detail page
- Error state shows a Go Back action for navigation recovery
