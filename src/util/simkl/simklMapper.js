/**
 * SIMKL Data Mapper
 * Utility functions to map SIMKL data structures to StrIve's internal format
 */

/**
 * Map SIMKL movie to StrIve format
 * @param {Object} simklMovie - Movie data from SIMKL
 * @param {number} imdbRating - Optional IMDb rating
 * @returns {Object} Mapped movie object
 */
/**
 * Map SIMKL movie to StrIve format
 * Only extracts what SIMKL actually provides
 * Ratings and metadata will be fetched by enrichment service
 * @param {Object} simklMovie - Movie data from SIMKL
 * @returns {Object} Mapped movie object
 */
export const mapSimklMovieToStrive = (simklMovie) => {
  return {
    // === IDs (convert tmdbId to number) ===
    id: parseInt(simklMovie.movie?.ids?.tmdb) || simklMovie.movie?.ids?.simkl,
    tmdbId: parseInt(simklMovie.movie?.ids?.tmdb) || null,
    simklId: simklMovie.movie?.ids?.simkl || null,
    imdbId: simklMovie.movie?.ids?.imdb || null,
    
    // === Basic Info (only what SIMKL provides) ===
    title: simklMovie.movie?.title || "",
    year: simklMovie.movie?.year || null,
    release_date: simklMovie.movie?.year 
      ? `${simklMovie.movie.year}-01-01` 
      : null,
    media_type: "movie",
    runtime: simklMovie.movie?.runtime || null,
    
    // === Poster (construct SIMKL CDN URL from hash) ===
    poster_path: simklMovie.movie?.poster 
      ? `https://simkl.in/posters/${simklMovie.movie.poster}_m.jpg`
      : null,
    
    // === User Data ===
    status: simklMovie.status || null,
    watchedAt: simklMovie.last_watched_at || null,
    addedToWatchlistAt: simklMovie.added_to_watchlist_at || null,
    user_rating: simklMovie.user_rating || null,
    
    // === Placeholders (NOT from SIMKL - filled by enrichment) ===
    overview: null,
    backdrop_path: null,
    tmdb_rating: null,
    tmdb_vote_count: null,
    imdb_rating: null,
    imdb_vote_count: null,
    
    // === Tracking ===
    enrichmentStatus: "pending",
    lastEnriched: null,
  };
};

/**
 * Map SIMKL show to StrIve format
 * @param {Object} simklShow - Show data from SIMKL
 * @param {number} imdbRating - Optional IMDb rating
 * @returns {Object} Mapped show object
 */
/**
 * Map SIMKL show to StrIve format
 * Only extracts what SIMKL actually provides
 * Ratings and metadata will be fetched by enrichment service
 * @param {Object} simklShow - Show data from SIMKL
 * @returns {Object} Mapped show object
 */
export const mapSimklShowToStrive = (simklShow) => {
  return {
    // === IDs (convert tmdbId to number) ===
    id: parseInt(simklShow.show?.ids?.tmdb) || simklShow.show?.ids?.simkl,
    tmdbId: parseInt(simklShow.show?.ids?.tmdb) || null,
    simklId: simklShow.show?.ids?.simkl || null,
    imdbId: simklShow.show?.ids?.imdb || null,
    tvdbId: parseInt(simklShow.show?.ids?.tvdb) || null,
    
    // === Basic Info ===
    title: simklShow.show?.title || "",
    year: simklShow.show?.year || null,
    first_air_date: simklShow.show?.year 
      ? `${simklShow.show.year}-01-01` 
      : null,
    media_type: "tv",
    runtime: simklShow.show?.runtime || null,
    
    // === Poster (construct SIMKL CDN URL from hash) ===
    poster_path: simklShow.show?.poster 
      ? `https://simkl.in/posters/${simklShow.show.poster}_m.jpg`
      : null,
    
    // === User Data ===
    status: simklShow.status || null,
    watchedAt: simklShow.last_watched_at || null,
    addedToWatchlistAt: simklShow.added_to_watchlist_at || null,
    user_rating: simklShow.user_rating || null,
    
    // === Placeholders (NOT from SIMKL - filled by enrichment) ===
    overview: null,
    backdrop_path: null,
    tmdb_rating: null,
    tmdb_vote_count: null,
    imdb_rating: null,
    imdb_vote_count: null,
    
    // === Tracking ===
    enrichmentStatus: "pending",
    lastEnriched: null,
  };
};

/**
 * Map SIMKL anime to StrIve format
 * @param {Object} simklAnime - Anime data from SIMKL
 * @param {number} imdbRating - Optional IMDb rating
 * @returns {Object} Mapped anime object
 */
/**
 * Map SIMKL anime to StrIve format
 * Anime has "show" key (not "anime") and anime_type field
 * Treats anime as movies (media_type: "movie")
 * @param {Object} simklAnime - Anime data from SIMKL
 * @returns {Object} Mapped anime object
 */
export const mapSimklAnimeToStrive = (simklAnime) => {
  return {
    // === IDs (convert tmdbId to number) ===
    id: parseInt(simklAnime.show?.ids?.tmdb) || simklAnime.show?.ids?.simkl,
    tmdbId: parseInt(simklAnime.show?.ids?.tmdb) || null,
    simklId: simklAnime.show?.ids?.simkl || null,
    imdbId: simklAnime.show?.ids?.imdb || null,
    
    // === Basic Info ===
    title: simklAnime.show?.title || "",
    year: simklAnime.show?.year || null,
    release_date: simklAnime.show?.year 
      ? `${simklAnime.show.year}-01-01` 
      : null,
    media_type: "movie",  // Treat anime as movies
    runtime: simklAnime.show?.runtime || null,
    
    // === Poster (construct SIMKL CDN URL from hash) ===
    poster_path: simklAnime.show?.poster 
      ? `https://simkl.in/posters/${simklAnime.show.poster}_m.jpg`
      : null,
    
    // === User Data ===
    status: simklAnime.status || null,
    watchedAt: simklAnime.last_watched_at || null,
    addedToWatchlistAt: simklAnime.added_to_watchlist_at || null,
    user_rating: simklAnime.user_rating || null,
    
    // === Placeholders (NOT from SIMKL - filled by enrichment) ===
    overview: null,
    backdrop_path: null,
    tmdb_rating: null,
    tmdb_vote_count: null,
    imdb_rating: null,
    imdb_vote_count: null,
    
    // === Tracking ===
    enrichmentStatus: "pending",
    lastEnriched: null,
  };
};

/**
 * Map StrIve movie to SIMKL format for pushing to API
 * @param {Object} movie - Movie data from StrIve
 * @returns {Object} SIMKL-formatted movie object
 */
export const mapStriveMovieToSimkl = (movie) => {
  const simklMovie = {
    title: movie.title,
    year: movie.year,
  };

  // Add IDs if available
  const ids = {};
  if (movie.tmdbId) ids.tmdb = movie.tmdbId;
  if (movie.imdbId) ids.imdb = movie.imdbId;
  if (movie.simklId) ids.simkl = movie.simklId;

  if (Object.keys(ids).length > 0) {
    simklMovie.ids = ids;
  }

  return simklMovie;
};

/**
 * Map StrIve show to SIMKL format for pushing to API
 * @param {Object} show - Show data from StrIve
 * @returns {Object} SIMKL-formatted show object
 */
export const mapStriveShowToSimkl = (show) => {
  const simklShow = {
    title: show.title,
    year: show.year,
  };

  // Add IDs if available
  const ids = {};
  if (show.tmdbId) ids.tmdb = show.tmdbId;
  if (show.imdbId) ids.imdb = show.imdbId;
  if (show.tvdbId) ids.tvdb = show.tvdbId;
  if (show.simklId) ids.simkl = show.simklId;

  if (Object.keys(ids).length > 0) {
    simklShow.ids = ids;
  }

  return simklShow;
};

/**
 * Create SIMKL history payload for marking items as watched
 * @param {Object} options - { movies: [], shows: [], episodes: [] }
 * @returns {Object} Formatted payload for /sync/history
 */
export const createHistoryPayload = ({
  movies = [],
  shows = [],
  episodes = [],
}) => {
  const payload = {};

  if (movies.length > 0) {
    payload.movies = movies.map((movie) => ({
      ...mapStriveMovieToSimkl(movie),
      watched_at: movie.watchedAt || new Date().toISOString(),
    }));
  }

  if (shows.length > 0) {
    payload.shows = shows.map((show) => ({
      ...mapStriveShowToSimkl(show),
      watched_at: show.watchedAt || new Date().toISOString(),
    }));
  }

  if (episodes.length > 0) {
    payload.episodes = episodes.map((episode) => ({
      watched_at: episode.watchedAt || new Date().toISOString(),
      ids: {
        simkl: episode.simklId,
      },
    }));
  }

  return payload;
};

/**
 * Create scrobble payload for video player
 * @param {Object} media - Media information
 * @param {number} progress - Progress percentage (0-100)
 * @returns {Object} Formatted scrobble payload
 */
export const createScrobblePayload = (media, progress = 0) => {
  const payload = { progress };

  if (media.type === "movie") {
    payload.movie = mapStriveMovieToSimkl(media);
  } else if (media.type === "show" || media.type === "tv") {
    payload.show = mapStriveShowToSimkl(media);

    if (media.episode) {
      payload.episode = {
        season: media.episode.season,
        number: media.episode.number,
      };
    }
  }

  return payload;
};

/**
 * Merge SIMKL sync data with existing StrIve data
 * Handles delta updates without overwriting entire lists
 * @param {Object} existing - Existing StrIve data
 * @param {Object} syncData - New data from SIMKL
 * @returns {Object} Merged data
 */
export const mergeSyncData = (existing = {}, syncData = {}) => {
  const merged = { ...existing };

  // Process movies
  if (syncData.movies) {
    const movieMap = new Map(
      existing.movies?.map((m) => [m.simklId || m.id, m]) || []
    );

    syncData.movies.forEach((simklMovie) => {
      const mapped = mapSimklMovieToStrive(simklMovie);
      movieMap.set(mapped.simklId || mapped.id, mapped);
    });

    merged.movies = Array.from(movieMap.values());
  }

  // Process shows
  if (syncData.shows) {
    const showMap = new Map(
      existing.shows?.map((s) => [s.simklId || s.id, s]) || []
    );

    syncData.shows.forEach((simklShow) => {
      const mapped = mapSimklShowToStrive(simklShow);
      showMap.set(mapped.simklId || mapped.id, mapped);
    });

    merged.shows = Array.from(showMap.values());
  }

  // Process anime
  if (syncData.anime) {
    const animeMap = new Map(
      existing.anime?.map((a) => [a.simklId || a.id, a]) || []
    );

    syncData.anime.forEach((simklAnime) => {
      const mapped = mapSimklAnimeToStrive(simklAnime);
      animeMap.set(mapped.simklId || mapped.id, mapped);
    });

    merged.anime = Array.from(animeMap.values());
  }

  return merged;
};

/**
 * Optimize image URL using wsrv.nl as recommended by SIMKL
 * @param {string} imageUrl - Original SIMKL image URL
 * @param {Object} options - { width, height, quality }
 * @returns {string} Optimized image URL
 */
export const optimizeSimklImage = (imageUrl, options = {}) => {
  if (!imageUrl) return "";

  const { width = 300, height, quality = 85 } = options;

  const params = new URLSearchParams({
    url: imageUrl,
    w: width,
    q: quality,
    output: "webp",
  });

  if (height) {
    params.append("h", height);
  }

  return `https://wsrv.nl/?${params.toString()}`;
};
