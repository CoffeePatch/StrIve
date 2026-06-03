/**
 * Unified Media Contract
 * 
 * Represents a normalized media object (Movie or TV Show) across the application.
 * All UI components should consume this format instead of source-specific APIs.
 * 
 * @typedef {Object} Media
 * @property {string|number} id - The unique identifier from the source.
 * @property {"tmdb" | "simkl" | "custom"} source - The origin of this data.
 * @property {string} title - Normalized from title (movies) or name (tv).
 * @property {"movie" | "tv"} mediaType - The type of media.
 * @property {Object} rating
 * @property {number} rating.score - e.g. TMDB vote_average or SIMKL score.
 * @property {number} [rating.imdbScore] - Optional IMDb score.
 * @property {number} [rating.imdbVotes] - Optional IMDb vote count.
 * @property {string} posterPath - URL or path to the poster image.
 * @property {string} backdropPath - URL or path to the backdrop image.
 * @property {string} releaseYear - Parsed from release_date or first_air_date.
 * @property {Object} [tracking] - Optional user tracking progress.
 * @property {string} [tracking.status] - e.g., 'watching', 'plan_to_watch'.
 * @property {string} [tracking.nextEpisodeLabel] - e.g., 'S1E1' for TV shows.
 */
