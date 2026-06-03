# Batch 3: Hook & Data Fetching Consolidation

## Category
Data Architecture

## Priority
High

## Severity
High

---

# 1. The Actual Problem
The application currently maintains separate data-fetching hooks for Movies and TV Shows even when they perform nearly identical responsibilities.

Examples identified:
```text
usePopularMovies
usePopularTVShows

useTopRatedMovies
useTopRatedTVShows

useMoviesByGenre
useTVShowsByGenre
```
These hooks often differ only by endpoint selection while duplicating Loading State, Error State, Caching Logic, Transformation Logic, and Pagination Logic.

---

# 2. Why This Is A Serious Problem
Every new feature must be implemented twice. (e.g., adding retry logic, request cancellation, or caching requires doing it for both movies and TV). The duplication grows continuously.

---

# 3. Current Symptoms
The application contains multiple movie-specific and TV-specific hooks that represent the same business concepts instead of a shared data abstraction.

---

# 4. Root Cause Analysis
The application was originally designed around content types instead of `Media -> Media Hook`. The same root cause created the Card duplication that Batch 1 solved.

---

# 5. Why Batch 3 Comes Before MediaDetails Consolidation
Current state: `MovieDetails` and `TVShowDetails` still use different data sources. Data should be unified first. Then UI consolidation becomes easier.

---

# 6. Industry Standard Approach
Modern applications usually separate UI Components from Data Retrieval and build generic hooks (e.g., `usePopularMedia(mediaType)` instead of maintaining separate files).

---

# 7. Recommended Architecture
Target:
```text
hooks/media/
usePopularMedia
useTopRatedMedia
useMediaByGenre
```

---

# 8. Data Flow Architecture
Target flow:
```text
TMDB API -> Fetcher -> Adapter -> Media Contract -> Hook -> UI
```
This aligns with the Media architecture introduced in Batch 1.

---

# 9. Firestore Impact
None. This batch must not change Firestore Collections, Documents, Tracking Storage, etc. The work is limited to TMDB Fetching, Hook Layer, and Data Mapping.

---

# 10. Scalability Benefits
A unified hook architecture allows new media types (Anime, Books, Games) to be added without duplicating fetch logic.

---

# 11. Future Architecture Vision
After Batch 3, the next step becomes Batch 4: MediaDetails Consolidation.

---

# 12. Migration Strategy
Phase 1: Audit all existing media-fetching hooks.
Phase 2: Group hooks by business purpose (Popular, Top Rated, Genre, Trending, Recommendations).
Phase 3: Create unified hook equivalents.
Phase 4: Refactor Movie pages.
Phase 5: Refactor TV pages.
Phase 6: Verify identical behavior.
Phase 7: Remove duplicated legacy hooks.
