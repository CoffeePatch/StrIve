# Firestore Schema Documentation

## Unified Tracking Model

This project uses a unified user-library schema for scale and consistency:

- Canonical user item store: `users/{userId}/library_items/{titleKey}`
- Status views (watchlist, watched, etc.) are filtered projections, not separate stores
- Custom lists are tags (`listIds`) on the same canonical item document

This avoids duplicate records, reduces drift, and keeps reads cheap.

## Primary Collections

### users/{userId}/library_items/{titleKey}

`titleKey` format:
- `tmdb_movie_{tmdbId}`
- `tmdb_tv_{tmdbId}`

Actual stored fields used by the app:
- `titleKey` (string, required)
- `tmdbId` (number)
- `mediaType` (string: `movie` | `tv`)
- `title` (string)
- `images` (map)
	- `tmdbPoster` (string | null)
	- `simklPoster` (string | null)
	- `imdbPoster` (string | null)
- `imdbId` (string | null)
- `imdbRating` (number | null)
- `imdbVotes` (number | null)
- `metadata` (map)
	- `genres` (string[])
	- `runtimeMinutes` (number | null)
- `ratings` (map)
	- `imdbScore` (number | null)
	- `imdbVotes` (number | null)
	- `tmdbScore` (number | null)
	- `tmdbVotes` (number | null)
- `releaseYear` (number | null)
- `tracking` (map)
	- `watchStatus` (string | null): `Plan to Watch` | `Watching` | `Completed` | `Dropped` | null
	- `listIds` (string[])
	- `addedAt` (timestamp)
	- `updatedAt` (timestamp)

TV-only fields:

- `tvProgress` (map, TV only)
	- `completionPercent` (number)
	- `nextToWatch` (map | null)
	- `totalEpisodes` (number)
	- `watchedEpisodes` (number)

Legacy documents may contain extra fields, but the app should only rely on the fields above.

## Normalization Pipeline

The app does not write Firestore documents directly from raw API payloads. It normalizes incoming media data first, then stores the normalized schema above.

### 1. Source payloads

Typical inputs come from:
- TMDB movie or TV responses
- IMDb lookup results for title/rating enrichment
- Simkl poster or metadata references when available

### 2. Normalization rules

The write path in `src/util/firebase/firestoreService.js` maps the source payload into the canonical Firestore document shape:

- `titleKey` is derived from TMDB id and media type: `tmdb_movie_{tmdbId}` or `tmdb_tv_{tmdbId}`
- `tmdbId` is stored as the numeric TMDB id
- `mediaType` is stored as `movie` or `tv`
- `title` is taken from the best available title field
- `images.tmdbPoster` is the primary poster source
- `images.simklPoster` and `images.imdbPoster` are fallback poster sources
- `imdbRating` and `imdbVotes` are preserved when available
- `ratings.tmdbScore` and `ratings.tmdbVotes` are written from TMDB values
- `ratings.imdbScore` and `ratings.imdbVotes` are written from IMDb values when available
- `metadata.genres` and `metadata.runtimeMinutes` are stored from the normalized media metadata
- `releaseYear` is derived from the release or first-air year
- `tracking.watchStatus`, `tracking.listIds`, `tracking.addedAt`, and `tracking.updatedAt` are written together on the canonical document
- `tvProgress` is only written for TV items and should not be assumed for movies

### 3. Default handling

- Missing poster fields should stay `null`, not empty strings
- Missing IMDb values should stay `null`
- Missing numeric counts should stay `null` or `0` only when the field is explicitly a count and the UI expects a numeric fallback
- Data should be merged into the existing canonical doc so list membership and timestamps are preserved

### 4. Read normalization

When the app reads from Firestore, it normalizes the stored document back into the UI shape by reading:
- `images.tmdbPoster` first, then `images.simklPoster`, then `images.imdbPoster`
- `ratings.imdbScore`, `ratings.imdbVotes`, `ratings.tmdbScore`, `ratings.tmdbVotes`
- `tracking.watchStatus`, `tracking.listIds`, `tracking.addedAt`, `tracking.updatedAt`
- `metadata.genres`, `metadata.runtimeMinutes`
- `tvProgress` when present

This keeps rendering schema-first and avoids guessing from empty placeholder fields.

### Future-ready TV Progress Block

Store this directly on `library_items` to support poster-level progress badge/progress bar:

- `progress` (map):
	- `watchedEpisodesCount` (number)
	- `totalEpisodesCount` (number)
	- `notAiredEpisodesCount` (number)
	- `completionPercent` (number 0-100)
	- `nextToWatch` (map | null): `{ seasonNumber, episodeNumber, episodeId }`
	- `lastWatched` (map | null): `{ seasonNumber, episodeNumber, watchedAt }`

Recommended behavior:
- For movies, `progress` can be null.
- For TV, compute `completionPercent` as:
	- `watchedEpisodesCount / max(totalEpisodesCount - notAiredEpisodesCount, 1) * 100`

### users/{userId}/custom_lists/{listId}

Custom lists remain as presentation/group metadata:

- `name` (string)
- `description` (string)
- `createdAt` (timestamp)
- `ownerId` (string)
- `isPinned` (boolean)
- `pinnedAt` (timestamp | null)

## Query and Index Strategy

Core queries:
- By status: `where(status == plan_to_watch|completed|watching|...)`
- By list: `where(listIds array-contains {listId})` or list subcollection projection
- Ordered feeds: `orderBy(updatedAt desc)`, `orderBy(sort.imdbRating desc)`

Recommended indexes:
- `library_items`: `(status, updatedAt desc)`
- `library_items`: `(status, sort.imdbRating desc)`
- `library_items`: `(status, sort.year desc)`
- `library_items`: `(listIds array-contains, updatedAt desc)` when needed

## Migration Policy

Migration should be idempotent:
- Re-running migration must never duplicate logical items.
- Canonical key must always be `titleKey`.
- Custom list membership must merge into `listIds`.
- Existing ratings/progress must be preserved unless missing.

## Access Control

Users can only access data where path `userId == request.auth.uid`.

Rules should enforce:
- Write/read limited to own user subtree
- Document-level validation for `mediaType`, `status`, and numeric ranges where practical