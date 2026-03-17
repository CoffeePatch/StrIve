export type FirestoreTimestamp = FirebaseFirestore.Timestamp | Date | string;

export type CatalogMovieKey = `tmdb_movie_${number}`;
export type CatalogTvKey = `tmdb_tv_${number}`;
export type TitleKey = CatalogMovieKey | CatalogTvKey;

export type CatalogEpisodeKey = `s${string}e${string}`;
export type EpisodeStateKey = `${CatalogTvKey}_s${string}e${string}`;

export type MediaType = "movie" | "tv";
export type WatchStatus = "plan_to_watch" | "watching" | "completed" | "dropped" | null;
export type EpisodeWatchState = "watched" | "unwatched" | "partial";
export type EpisodeStateSource = "manual" | "import" | "auto";

export type ListKind = "custom" | "system_watchlist" | "system_watched" | "favorites";
export type ListVisibility = "private" | "public" | "unlisted";

export interface CatalogRatings {
  tmdb: number | null;
  imdb: number | null;
  voteCount: number;
}

export interface CatalogStats {
  popularity: number | null;
}

export interface CatalogTitleDoc {
  provider: "tmdb";
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  originalTitle?: string;
  releaseDate: FirestoreTimestamp | null;
  genres: string[];
  posterPath?: string;
  backdropPath?: string;
  overview?: string;
  ratings: CatalogRatings;
  stats: CatalogStats;
  updatedAt: FirestoreTimestamp;
}

export interface CatalogSeasonDoc {
  seasonNumber: number;
  episodeCount: number;
  airedEpisodeCount: number;
  name?: string;
  airDate: FirestoreTimestamp | null;
  updatedAt: FirestoreTimestamp;
}

export interface CatalogEpisodeDoc {
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  overview?: string;
  airDate: FirestoreTimestamp | null;
  runtime: number | null;
  isAired: boolean;
  absoluteOrder: number;
  updatedAt: FirestoreTimestamp;
}

export interface LibrarySortFields {
  imdbRating: number | null;
  tmdbRating: number | null;
  popularity: number | null;
  year: number | null;
  titleLower: string;
}

export interface LibraryWatchCounters {
  watchedEpisodesCount: number;
  totalEpisodesCount: number;
  airedEpisodesCount: number;
  unAiredEpisodesCount: number;
  completionRatio: number;
}

export interface UserLibraryItemDoc {
  titleKey: TitleKey;
  mediaType: MediaType;
  status: WatchStatus;
  listIds: string[];
  userRating: number | null;
  addedAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
  lastWatchedAt: FirestoreTimestamp | null;
  watchCounters: LibraryWatchCounters;
  sort: LibrarySortFields;
}

export interface EpisodeStateDoc {
  titleKey: CatalogTvKey;
  seasonNumber: number;
  episodeNumber: number;
  absoluteOrder: number;
  state: EpisodeWatchState;
  watchedAt: FirestoreTimestamp | null;
  updatedAt: FirestoreTimestamp;
  source: EpisodeStateSource;
}

export interface LastWatchedEpisodeRef {
  seasonNumber: number;
  episodeNumber: number;
  watchedAt: FirestoreTimestamp;
}

export interface NextEpisodeRef {
  seasonNumber: number;
  episodeNumber: number;
  airDate: FirestoreTimestamp | null;
}

export interface SeriesProgressDoc {
  titleKey: CatalogTvKey;
  watchedEpisodesCount: number;
  airedEpisodesCount: number;
  totalEpisodesCount: number;
  completionRatioAired: number;
  completionRatioTotal: number;
  lastWatchedEpisode: LastWatchedEpisodeRef | null;
  nextEpisode: NextEpisodeRef | null;
  updatedAt: FirestoreTimestamp;
}

export interface UserListDoc {
  name: string;
  description?: string;
  kind: ListKind;
  visibility: ListVisibility;
  isPinned: boolean;
  itemCount: number;
  createdAt: FirestoreTimestamp;
  updatedAt: FirestoreTimestamp;
  ownerId: string;
}

export interface ListItemDisplaySnapshot {
  title: string;
  posterPath?: string;
  releaseDate: FirestoreTimestamp | null;
}

export interface UserListItemDoc {
  titleKey: TitleKey;
  mediaType: MediaType;
  addedAt: FirestoreTimestamp;
  position: string | number;
  sort: LibrarySortFields;
  display: ListItemDisplaySnapshot;
}

export interface FirestorePaths {
  catalogTitle: (titleKey: TitleKey) => `catalog_titles/${TitleKey}`;
  catalogSeason: (titleKey: TitleKey, seasonNumber: number) => `catalog_titles/${TitleKey}/seasons/${number}`;
  catalogEpisode: (titleKey: TitleKey, episodeKey: CatalogEpisodeKey) => `catalog_titles/${TitleKey}/episodes/${CatalogEpisodeKey}`;
  userLibraryItem: (uid: string, itemKey: string) => `users/${string}/library_items/${string}`;
  userEpisodeState: (uid: string, episodeStateKey: EpisodeStateKey) => `users/${string}/episode_states/${EpisodeStateKey}`;
  userSeriesProgress: (uid: string, titleKey: CatalogTvKey) => `users/${string}/series_progress/${CatalogTvKey}`;
  userList: (uid: string, listId: string) => `users/${string}/lists/${string}`;
  userListItem: (uid: string, listId: string, itemKey: string) => `users/${string}/lists/${string}/items/${string}`;
}
