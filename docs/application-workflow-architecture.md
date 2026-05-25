# Application Workflow and Firestore Architecture

## Purpose

This document explains how the application is intended to work from the user's point of view, how data moves through the app, and which Firestore documents are created or updated along the way.

The goal is to give a clear reference for understanding normal behavior, spotting mismatches, and repairing unexpected data issues without needing to read the code first.

## High-Level Model

The application is built around one user-owned media library. The library stores the user's titles, status, list membership, and TV progress in Firestore. Separate documents track TV episode watch state and per-series progress so the app can recover the user's exact place in a show.

The app also keeps a catalog of titles and episodes as shared read-only source data. User actions update the user's own documents, while the catalog remains the shared reference for title and episode information.

## Step-by-Step Workflow

### 1. User signs in

The app identifies the signed-in user and loads that user's library, lists, and progress data. From this point onward, all saved data belongs to that user.

### 2. User browses or searches for a title

The user opens movies, TV shows, search results, or a title detail page. The app shows title information from the shared catalog and any user-specific state from Firestore, such as whether the title is on a watchlist or already completed.

### 3. User saves a title to their library

When the user adds a movie or show to their watchlist or marks it as watched, the app stores a normalized library record for that title. This record becomes the main place where the app remembers the user's relationship with the title.

### 4. User adds the title to one or more lists

Purpose: stores user-owned account data and preferences that are not tied to a specific title.

Typical contents: profile-related fields, app settings, and other user-level metadata.
### Canonical Library Items

Path: `users/{uid}/library_items/{titleKey}`

Purpose: the main record for a movie or TV show in a user's library.

Document ID: a stable title key for the media item.

Common fields:

- `titleKey`
- `mediaType`
- `tmdbId`
- `ratings.imdbScore`
- `ratings.imdbVotes`
- `tracking.watchStatus`
- `progressNeedsRecompute`
- `tvProgress.totalEpisodes`
- `tvProgress.watchedEpisodes`
- `tvProgress.completionPercent`
- `tvProgress.nextToWatch`
	- `seasonNumber`
	- `episodeNumber`
	- `null` when no next episode is available


- Whether the user wants to watch the title, is actively watching it, has completed it, or has dropped it.
- Which custom lists include the title.

### TV Series Progress Summary

Path: `users/{uid}/series_progress/{titleKey}`

Purpose: a compact per-series summary for TV shows.

Common fields:

- `titleKey`
- `watchedEpisodesCount`
- `airedEpisodesCount`
- `totalEpisodesCount`
- `completionRatioAired`
- `completionRatioTotal`
- `lastWatchedEpisode`
- `nextEpisode`
- `progressNeedsRecompute`
- `updatedAt`

What this document represents:

- How many episodes the user has watched.
- How far through the aired episodes the user is.
- Which episode was watched most recently.
- Which episode should be watched next.

### Watched Episode Records

Path: `users/{uid}/episode_states/{episodeStateKey}`

Purpose: one record for each watched episode of a TV series.

Common fields:

- `titleKey`
- `seasonNumber`
- `episodeNumber`
- `absoluteOrder`
- `state`
- `watchedAt`
- `updatedAt`
- `source`

What this document represents:

- The exact episode the user watched.
- The order of the episode within the series.
- When the episode was marked watched.
- Where the watch event came from.

### Custom Lists

Path: `users/{uid}/lists/{listId}`

Purpose: the list header or container for a user-created list.

Common fields:

- `name`
- `description`
- `kind`
- `visibility`
- `isPinned`
- `itemCount`
- `createdAt`
- `updatedAt`
- `ownerId`

What this document represents:

- The list's display name.
- Whether the list is private, public, or unlisted.
- Whether it is pinned for quick access.
- Who owns the list.

Membership for this list is stored on the matching `users/{uid}/library_items/{titleKey}` document through `tracking.listIds`.

### List Membership

Path: `users/{uid}/library_items/{titleKey}`

Purpose: the membership record for Watchlist and custom lists.

Common fields:

- `tracking.listIds`

What this field represents:

- All lists that include the title.
- The Watchlist, when present, is treated like any other list identifier.

### Shared Catalog Data

Path: `catalog_titles/{titleKey}`

Purpose: shared read-only reference data for each movie or TV show.

Typical contents: title-level metadata such as media type and title-level information used to support the user library.

Path: `catalog_titles/{titleKey}/episodes/{episodeKey}`

Purpose: shared read-only episode catalog for TV shows.

Typical contents: season number, episode number, absolute order, aired status, and air date.

## What Gets Created Or Updated

### When a user adds a movie or show to their watchlist

The app creates or updates the user's library record for that title. The record stores the title identity, status, artwork, metadata, ratings, and tracking information.

### When a user marks a TV episode as watched

The app creates or updates one watched-episode record, refreshes the series progress summary, and updates the title's library record so the library view stays current.

### When a user creates a custom list

The app creates a list document for the new list. As titles are added, the related library record is updated so its `tracking.listIds` array reflects membership.

### When a user imports a CSV file

The app creates list item records for the selected destination list. If the imported title already exists, the app treats it as an existing item rather than duplicating it.

### When a user exports a list

The app reads the stored list records and generates a portable file for the user. No Firestore data is changed during export.

## Data Consistency Rules

### Library record is the main source of truth

If a title is saved, the canonical library record should exist. Other views should be able to rebuild their display from that record plus the shared catalog.

### TV progress must agree with watched episodes

The episode records, series progress summary, and TV library record should tell the same story. If one of them is missing or stale, the title may show the wrong progress or the wrong next episode.

### List membership should match the library record and list item records

If a title appears in a list, the membership should be visible in the list itself and in the title's tracking data. If they diverge, list screens and library filters may disagree.

### Read-only catalog data should not be treated as user data

The shared catalog is the reference layer. User-specific behavior should be driven by the user's own documents, not by editing the catalog directly.

## What To Check When Something Looks Wrong

### A title is missing from the library

Check whether the user has a library record for that title and whether the tracking state was updated recently.

### A list looks empty even though items were added

Check the list document, then confirm the list item records exist and the title's list membership data still includes that list.

### TV progress is incorrect

Check the watched episode records first, then confirm the series progress summary and library record were refreshed afterward.

### A title shows stale artwork or ratings

Check whether the catalog data and the library record were both refreshed after enrichment.
