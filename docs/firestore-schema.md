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

Recommended fields:
- `titleKey` (string, required)
- `id` (string or number TMDB id)
- `mediaType` (string: `movie` | `tv`)
- `media_type` (string mirror for backward compatibility)
- `title` (string)
- `name` (string)
- `poster_path` (string)
- `overview` (string)
- `release_date` (string)
- `first_air_date` (string)
- `status` (string | null): `plan_to_watch` | `watching` | `completed` | `dropped` | null
- `listIds` (string[]) custom list tags
- `vote_average` (number) TMDB score
- `vote_count` (number) TMDB votes
- `imdbId` (string | null)
- `imdbRating` (number | null)
- `imdbVotes` (number | null)
- `sort` (map):
	- `tmdbRating` (number)
	- `tmdbVotes` (number)
	- `imdbRating` (number | null)
	- `imdbVotes` (number | null)
	- `year` (number | null)
- `userRating` (number | null)
- `addedAt` (timestamp)
- `updatedAt` (timestamp)
- `lastWatchedAt` (timestamp | null)

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

### users/{userId}/custom_lists/{listId}/items/{mediaId}

Legacy/compatibility path. Data should be migrated and maintained in `library_items`.

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