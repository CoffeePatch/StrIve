const BATCH_SIZE = 100;

async function getAuthHeader() {
  try {
    const { auth } = await import("../../util/firebase/firebase.js");
    const user = auth?.currentUser;
    if (!user) return {};
    const token = await user.getIdToken();
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}

/**
 * Builds Simkl-compatible movie and show payloads from Strive PostgreSQL library items.
 */
export function buildSimklPayloads(libraryItems = [], episodeStates = []) {
  const moviesHistory = [];
  const moviesRatings = [];
  const showsHistory = [];
  const showsRatings = [];

  // Group episode states by titleKey
  const episodeMap = new Map();
  for (const ep of episodeStates) {
    if (!ep.titleKey || ep.state !== "watched") continue;
    if (!episodeMap.has(ep.titleKey)) {
      episodeMap.set(ep.titleKey, []);
    }
    episodeMap.get(ep.titleKey).push({
      season: ep.seasonNumber,
      number: ep.episodeNumber,
      watched_at: ep.watchedAt ? new Date(ep.watchedAt).toISOString() : new Date().toISOString(),
    });
  }

  for (const item of libraryItems) {
    const catalog = item.catalogTitle || item;
    const mediaType = catalog.mediaType || item.mediaType || "movie";
    const tmdbId = catalog.tmdbId || item.tmdbId;
    const imdbId = catalog.imdbId || item.imdbId;
    const title = catalog.title || item.title || catalog.titleKey;

    if (!tmdbId && !imdbId) continue; // Skip items without valid Simkl-compatible identifier

    const ids = {};
    if (tmdbId) ids.tmdb = Number(tmdbId);
    if (imdbId) ids.imdb = String(imdbId);

    const isWatched = item.status === "completed" || item.status === "watching";
    const rawRating = item.userRating ? Number(item.userRating) : null;
    const userRating = Number.isFinite(rawRating) && rawRating > 0 ? Math.min(10, Math.max(1, Math.round(rawRating))) : null;
    const watchedAt = item.lastWatchedAt ? new Date(item.lastWatchedAt).toISOString() : new Date().toISOString();

    if (mediaType === "movie") {
      if (isWatched) {
        moviesHistory.push({
          title,
          ids,
          watched_at: watchedAt,
        });
      }
      if (userRating) {
        moviesRatings.push({
          title,
          ids,
          rating: userRating,
        });
      }
    } else if (mediaType === "tv") {
      const episodes = episodeMap.get(item.titleKey) || [];
      if (isWatched || episodes.length > 0) {
        showsHistory.push({
          title,
          ids,
          episodes: episodes.length > 0 ? episodes : undefined,
          watched_at: isWatched ? watchedAt : undefined,
        });
      }
      if (userRating) {
        showsRatings.push({
          title,
          ids,
          rating: userRating,
        });
      }
    }
  }

  return {
    history: { movies: moviesHistory, shows: showsHistory },
    ratings: { movies: moviesRatings, shows: showsRatings },
  };
}

/**
 * Splits formatted payloads into sequential 100-item batch chunks.
 */
export function createSimklBatches(payload, action = "history") {
  const batches = [];
  const items = [];

  for (const m of payload.movies || []) {
    items.push({ type: "movie", data: m });
  }
  for (const s of payload.shows || []) {
    items.push({ type: "show", data: s });
  }

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const chunk = items.slice(i, i + BATCH_SIZE);
    const chunkMovies = chunk.filter(c => c.type === "movie").map(c => c.data);
    const chunkShows = chunk.filter(c => c.type === "show").map(c => c.data);

    batches.push({
      action,
      payload: {
        movies: chunkMovies.length > 0 ? chunkMovies : undefined,
        shows: chunkShows.length > 0 ? chunkShows : undefined,
      },
      itemCount: chunk.length,
    });
  }

  return batches;
}

/**
 * Sequential Client Sync Controller
 * Sends 100-item batch chunks sequentially (1 Strive API call = 1 Simkl API call).
 */
export async function executeSimklSync(batches = [], options = {}) {
  const { onProgress, isCancelled } = options;
  const headers = await getAuthHeader();

  let totalProcessed = 0;
  let totalAdded = 0;

  for (let i = 0; i < batches.length; i++) {
    if (isCancelled && isCancelled()) {
      return { success: false, cancelled: true, processed: totalProcessed, totalBatches: batches.length, currentBatch: i };
    }

    const batch = batches[i];
    const response = await fetch("/api/simkl/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify({
        action: batch.action,
        payload: batch.payload,
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      if (response.status === 429) {
        throw new Error(`Simkl API rate limit reached (${errData?.error?.message || "HTTP 429"}). Synchronization paused.`);
      }
      if (response.status === 401) {
        throw new Error("Simkl authorization expired or revoked. Please reconnect Simkl in Settings.");
      }
      throw new Error(errData?.error?.message || `Sync batch ${i + 1} failed (HTTP ${response.status})`);
    }

    const data = await response.json();
    totalProcessed += batch.itemCount;
    if (data.added) {
      totalAdded += (data.added.movies || 0) + (data.added.shows || 0) + (data.added.episodes || 0);
    }

    if (onProgress) {
      onProgress({
        currentBatch: i + 1,
        totalBatches: batches.length,
        processed: totalProcessed,
        added: totalAdded,
        percent: Math.round(((i + 1) / batches.length) * 100),
      });
    }
  }

  return {
    success: true,
    totalBatches: batches.length,
    processed: totalProcessed,
    added: totalAdded,
  };
}
