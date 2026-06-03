# Batch 2: Detail Page Component Decomposition

## 1. Problem Description

The application currently relies on two massive monolithic files for displaying media details:
- `MovieDetails.jsx` (~500 lines)
- `TVShowDetailsPage.jsx` (~1200 lines)

Both files mix complex data fetching, intricate business logic (especially for TV episode tracking), and hundreds of lines of presentational UI (Tailwind JSX). They share identical visual designs for headers, cast lists, and action buttons, but these UI elements are completely duplicated across the two files.

## 2. Why It Is A Problem

Monolithic components violate the Single Responsibility Principle. By mixing state, side effects, and presentation in a single file, the code becomes inherently fragile. 
- A change to the visual styling of the "Watchlist" button in movies must be manually replicated in TV shows.
- Complex TV tracking logic is visually buried under hundreds of lines of static JSX.
- Future feature additions (e.g., responsive mobile layouts) will require updating duplicate layout code in multiple massive files, exponentially increasing the risk of UI inconsistencies and regressions.

## 3. Current Symptoms

- High cognitive load required to modify or debug either detail page.
- Identical DOM structures and Tailwind classes are copy-pasted between files.
- Visual regressions occur easily because a fix in one file is forgotten in the other.
- The `TVShowDetailsPage.jsx` is extremely difficult to read because highly complex domain logic (optimistic UI updates, syncing states, episode catalog generation) is interleaved with static HTML/CSS.

## 4. Root Cause Analysis

The architecture evolved feature-by-feature rather than component-by-component. When TV tracking was added, it required specialized logic, so the entire `MovieDetails` UI was copied into a new `TVShowDetails` file rather than extracting the shared UI into a common library. The UI became tightly coupled to the specific data-fetching hooks of each media type.

## 5. Verified Shared Sections

Based on direct code inspection, both files share the exact same structural JSX for:
- **MediaHero / Header:** Full-bleed backdrop images, gradient overlays, title/logo fallback, meta-info row, and overview text.
- **MediaRatings:** Custom styled pill badges displaying aggregate scores for IMDb and TMDB.
- **MediaActions:** The row of circular action buttons (Play, Trailer, Watchlist, Watched, Add to List) with expanding label hover effects and `AddToListPopover` integration.
- **MediaGenres:** Horizontal list of glass-effect genre tags.
- **MediaCast:** Horizontally scrolling cast list, checking for `profile_path` and rendering a fallback icon if missing.
- **Recommendations:** A grid displaying similar/recommended media.

## 6. Verified Movie-Only Sections

- **Inline Recommendations:** `MovieDetails.jsx` maps `movieDetails.similar.results` directly in the JSX.
- **Meta Info Formatting:** Displays runtime directly (e.g., "1h 45m") instead of season counts.

## 7. Verified TV-Only Sections

- **Tracking Interface:** `SeriesProgressBar`.
- **Episode Viewers:** `EpisodeViewToggle`, `SeasonTabs`, `EpisodeMatrixView`, `EpisodeListItem`, and `EpisodeCard`.
- **Recommendations:** Uses an external `<SimilarShowsPanel tvId={tvId} />` component.
- **Modals:** `EpisodeOverlay`, Watch Choice Modal (single vs backfill), and Unwatch Series Confirmation Modal.
- **Navigation:** Explicit absolute-positioned Back arrow over the hero image.

## 8. Shared Business Logic

- **Library Hydration:** Both use `useLibraryItemStatus` to read initial states.
- **Library Mutation:** Both use `setLibraryItemStatus` for "Plan to Watch" and "Completed" top-level toggles.
- **Lists / Auth:** Both implement identical `useRequireAuth`, `fetchLists`, and popover hover-timeout logic.
- **IMDb:** Both call `useImdbTitle` to fetch aggregate ratings.

## 9. Different Business Logic

- **Data Fetching:** 
  - `MovieDetails` relies on a raw `fetch` inside a `useLayoutEffect`.
  - `TVShowDetailsPage` relies on custom hooks (`useTvShowDetails`, `useTvSeasonEpisodes`, `useTvVideos`).
- **Tracking Logic:**
  - `MovieDetails` operates on simple boolean toggles.
  - `TVShowDetailsPage` uses a complex array of custom hooks (`useEpisodeStates`, `useSeriesProgress`, `useMarkEpisodeWatched`) to handle optimistic UI, sync states, and absolute episode ordering.

## 10. Industry Standard Approach

The standard solution for React monoliths is **Presentational Component Extraction** (often called "Dumb Components"). 
- Complex parent containers act as the "Controller", handling all data fetching and state mutations.
- The parent passes normalized data and callback functions (`onClick`) down to small, isolated presentational components.
- Presentational components handle zero business logic, focusing purely on DOM structure and CSS.

## 11. Recommended Architecture

We must separate the "What" (the data and tracking logic) from the "How" (the visual layout). 

1. Create a `MediaDetails` component library.
2. Separate into Shared vs TV-specific components to avoid forcing bad abstractions early.
3. Leave the complex tracking and fetching hooks inside the parent container files (`MovieDetails.jsx` and `TVShowDetailsPage.jsx`).
4. The parents will pass the data and necessary callbacks into the new UI components.

**Shared Components**
- `MediaHero`
- `MediaInfo`
- `MediaRatings`
- `MediaActions`
- `MediaGenres`
- `MediaCast`
- `MediaRecommendations`

**TV Components**
- `MediaProgress`
- `SeasonSelector`
- `EpisodeList`
- `EpisodeCard`
- `EpisodeOverlay`

## 12. Desktop-Only Component Architecture

As a strict constraint, Batch 2 will ignore all responsive breakpoints, mobile toolbars, and tablet layouts. The extracted components will use the existing Tailwind desktop classes exactly as they are currently written. 

Responsive integration will be treated as an entirely separate future batch to isolate risk.

## 13. Firestore Constraints

This architectural extraction operates strictly on the UI layer. 
- The Firestore Schema (Collections, Documents) is frozen.
- The Tracking Storage, Watch Progress Storage, and SIMKL Storage are frozen.
- The parent containers will continue to use the exact same Firestore hooks (`setLibraryItemStatus`, `useMarkEpisodeWatched`) and pass the resulting data directly to the new UI components.

## 14. Scalability Benefits

- **DRY Code:** Updating the styling of the Hero section or Cast list will now require changing only one file, immediately fixing both Movie and TV pages.
- **Cognitive Load:** Developers modifying TV tracking logic will no longer have to scroll through 800 lines of Tailwind JSX.
- **Future-Proofing:** When the Responsive Architecture batch begins, developers will only need to add mobile breakpoints to the isolated `<MediaHero />` component, rather than modifying massive parent files.

## 15. Migration Strategy

To ensure zero regressions, we will follow a multi-step migration:

**Phase 1: Shared Component Extraction**
- `MediaHero`
- `MediaRatings`
- `MediaActions`
- `MediaGenres`
- `MediaCast`

**Phase 2: MovieDetails Refactor**
- Replace only shared sections.
- Verify parity.

**Phase 3: TVShowDetails Refactor**
- Replace only shared sections.
- Verify parity.

**Phase 4: TV-Specific Extraction**
- Season Selector
- Episode Components
- Progress Components
- Episode Modals

**Phase 5: Cleanup**
- Ensure all legacy inline JSX is removed.

## 16. Final Recommendation

Batch 2 should be approved for immediate execution. Extracting the detail page UI into isolated components is a necessary prerequisite before any future attempts are made to consolidate the data fetching hooks or implement responsive mobile layouts. 

Proceeding with the Desktop-Only Component Extraction first will vastly reduce the complexity of the codebase while respecting all frozen database contracts.
