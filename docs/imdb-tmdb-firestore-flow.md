# IMDb / TMDB to Firestore Flow

This document reflects the current implementation, not the older legacy notes that used to live here. The goal is to describe the canonical write path, the actual schema that is being written, and the places where old or incorrect assumptions still appear in the codebase.

The current system does not store raw IMDb or TMDB payloads. It extracts a small set of fields, normalizes them, and writes them into a canonical `library_items` document per media item.

## Source Data Used By The App

### IMDb

The IMDb lookup is used for enrichment only. The code reads:

- `id`
- `rating.aggregateRating` or`rating.ratingValue`
- `rating.voteCount` or`rating.ratingCount`
- `primaryImage.url` when an IMDb poster is available

Everything else from the IMDb response is ignored for Firestore writes.

### TMDB

TMDB is the primary source for item identity and base metadata. The code reads:

- `id`
- `title` or`name`
- `overview`
- `poster_path`
- `release_date` for movies
- `first_air_date` for TV
- `vote_average`
- `vote_count`
- `genres`
- `runtime`
- `number_of_episodes` for TV progress defaults

TMDB also supplies the canonical release date for cleanup and enrichment jobs.

## Canonical Write Model

The active write target is:

`users/{uid}/library_items/{titleKey}`

The current key format is:

- `tmdb_movie_{tmdbId}`
- `tmdb_tv_{tmdbId}`

The write helper lives in [src/util/firebase/firestoreService.js](../src/util/firebase/firestoreService.js) and the cleanup scripts operate on the same collection.

### Stored Fields

The canonical document is centered around these fields:

- `titleKey`
- `mediaType`
- `tmdbId`
- `imdbId`
- `title`
- `images.tmdbPoster`
- `images.imdbPoster`
- `releaseDate`
- `metadata.genres`
- `metadata.runtimeMinutes`
- `ratings.imdbScore`
- `ratings.imdbVotes`
- `ratings.tmdbScore`
- `ratings.tmdbVotes`
- `tracking.watchStatus`
- `tracking.listIds`
- `tracking.addedAt`
- `tracking.updatedAt`
- `tracking.lastWatchedAt`
- `tvProgress` for TV items only

### TV Progress

TV progress is normalized to:

- `tvProgress.totalEpisodes`
- `tvProgress.watchedEpisodes`
- `tvProgress.completionPercent`
- `tvProgress.nextToWatch`

The cleanup job now normalizes `nextToWatch` to a structured map with:

- `seasonNumber`
- `episodeNumber`

## Current UI Write Flows

The UI has been migrated away from the old `addToList()` path and now uses the canonical helper.

### Add To Watchlist

Components such as [PosterTitle.jsx](../src/components/media/PosterTitle.jsx), [TVShowDetails.jsx](../src/components/tv/TVShowDetails.jsx), and the movie details flow build a media object and call `upsertLibraryItem()` with `status: "Plan to Watch"`.

### Mark Completed

[MoviePlayer.jsx](../src/components/movie/Player/MoviePlayer.jsx) and [TVShowPlayer.jsx](../src/components/tv/TVShowPlayer.jsx) now write through `upsertLibraryItem()` with `status: "Completed"`.

### List Membership

Custom list membership is stored on the canonical item document in `tracking.listIds`. The list UI now updates that array instead of writing to a separate legacy item collection.

### Status Reads

Reads such as [SettingsPage.jsx](../src/components/settings/SettingsPage.jsx) query canonical library status rather than relying on the old collection layout.

## What Is Saved, And What Is Not

### Saved

- Canonical identity:`titleKey`,`tmdbId`,`mediaType`,`imdbId`
- Display data:`title`,`images`,`releaseDate`,`metadata`
- Ratings:`ratings.*`
- User tracking:`tracking.*`
- TV-only progress:`tvProgress.*`

### Not Saved

These fields should not be treated as canonical storage:

- raw IMDb response objects
- raw TMDB response objects
- `directors`,`writers`,`stars`
- `production_companies`,`production_countries`
- `budget`,`revenue`
- season and episode payloads from TMDB
- legacy root fields like`poster_path`,`vote_average`,`vote_count`,`first_air_date`,`name`, and`media_type`

## Current End State

The current architecture is:

1. Source data arrives from TMDB and IMDb.
2. The UI or helper layer normalizes it.
3. The app writes one canonical document to`users/{uid}/library_items/{titleKey}`.
4. That is the model this repository should converge on.

## Related Files

- [src/util/firebase/firestoreService.js](../src/util/firebase/firestoreService.js)
- [src/components/media/PosterTitle.jsx](../src/components/media/PosterTitle.jsx)
- [src/components/movie/Player/MoviePlayer.jsx](../src/components/movie/Player/MoviePlayer.jsx)
- [src/components/tv/TVShowDetails.jsx](../src/components/tv/TVShowDetails.jsx)
- [src/components/tv/TVShowPlayer.jsx](../src/components/tv/TVShowPlayer.jsx)
