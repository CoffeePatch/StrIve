**Library Page**
- Route `/library`; page component `LibraryMasterPage` in [src/components/library/LibraryMasterPage.jsx](src/components/library/LibraryMasterPage.jsx); route wired in [src/components/layout/Body.jsx](src/components/layout/Body.jsx)
- App shell uses `Header` [src/components/layout/Header.jsx](src/components/layout/Header.jsx) and `Footer` [src/components/layout/Footer.jsx](src/components/layout/Footer.jsx)
- Hero controls include title, item count, import button, view-mode toggle, and sort dropdown in `LibraryMasterPage`
- Status tabs for Plan to Watch, Watching, Completed, and Custom Lists; custom list selector and list actions when Custom is active
- Filter and search area combines `LibraryAdvancedFilters` [src/components/library/LibraryAdvancedFilters.jsx](src/components/library/LibraryAdvancedFilters.jsx) with the search bar
- Results area uses `LibraryGrid` [src/components/library/LibraryGrid.jsx](src/components/library/LibraryGrid.jsx) to render grid or bookshelf views

**Data + State**
- Library queries and updates use helpers from [src/util/firebase/firestoreService.js](src/util/firebase/firestoreService.js)
- List filtering, search, and filter state come from `useLibraryFilters` [src/hooks/library/useLibraryFilters.js](src/hooks/library/useLibraryFilters.js)
- Sorting uses `rating-desc`, `rating-asc`, and `date` options in `LibraryMasterPage`
- Card rendering uses `MovieCard` [src/components/movie/Cards/MovieCard.jsx](src/components/movie/Cards/MovieCard.jsx) and `TVShowCard` [src/components/tv/TVShowCard.jsx](src/components/tv/TVShowCard.jsx)
- Custom list metadata is loaded via `fetchUserLists` in `LibraryMasterPage`

**Interactions**
- Tab changes re-query library items by status or list and reset search text
- View mode toggle switches between grid and bookshelf layouts in `LibraryGrid`
- Sort dropdown reorders items by IMDb rating or date
- Remove item triggers Firestore updates with an undo toast in `LibraryMasterPage`
- Custom list menu supports edit, delete, and export CSV actions in `LibraryMasterPage`
- Import button routes to `/import` from the hero controls
