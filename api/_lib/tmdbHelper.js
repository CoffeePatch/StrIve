import { fetchWithTimeout, pLimit } from "./utils.js";

/**
 * Fetches the complete catalog of episodes for a TV show from TMDB.
 * Excludes Season 0 (Specials) to match frontend progress tracking behavior.
 * 
 * @param {number|string} tvId - The TMDB ID of the TV show
 * @returns {Promise<Array>} - Flat array of episode objects
 */
export async function fetchEpisodesFromTmdb(tvId) {
  const apiKey = process.env.TMDB_API_KEY || process.env.VITE_TMDB_KEY;
  if (!apiKey) {
    throw new Error("TMDB API key not configured on server.");
  }

  // 1. Fetch TV show details to find number of seasons
  const detailsUrl = `https://api.themoviedb.org/3/tv/${tvId}?api_key=${apiKey}`;
  const detailsRes = await fetchWithTimeout(detailsUrl);
  if (!detailsRes.ok) {
    throw new Error(`Failed to fetch TMDB details for TV ${tvId}: HTTP ${detailsRes.status}`);
  }
  
  const details = await detailsRes.json();
  const numberOfSeasons = details.number_of_seasons;
  if (!numberOfSeasons || numberOfSeasons < 1) {
    return [];
  }

  // 2. Fetch all seasons in parallel with concurrency limit of 5
  const limit = pLimit(5);
  const seasonPromises = [];

  for (let s = 1; s <= numberOfSeasons; s++) {
    seasonPromises.push(
      limit(async () => {
        const seasonUrl = `https://api.themoviedb.org/3/tv/${tvId}/season/${s}?api_key=${apiKey}`;
        const res = await fetchWithTimeout(seasonUrl);
        if (!res.ok) {
          console.warn(`Failed to fetch TMDB TV ${tvId} Season ${s}: HTTP ${res.status}`);
          return null;
        }
        return res.json();
      })
    );
  }

  const seasonsResults = await Promise.all(seasonPromises);
  const allEpisodes = [];

  for (const seasonData of seasonsResults) {
    if (!seasonData || !Array.isArray(seasonData.episodes)) continue;
    const seasonNumber = seasonData.season_number;
    for (const ep of seasonData.episodes) {
      const episodeNumber = ep.episode_number;
      // Use the absolute order fallback matching frontend: seasonNumber * 1000 + episodeNumber
      const absoluteOrder = ep.absolute_order || (seasonNumber * 1000 + episodeNumber);
      const airDate = ep.air_date || null;
      const isAired = airDate ? new Date(airDate) <= new Date() : true;

      allEpisodes.push({
        seasonNumber,
        episodeNumber,
        absoluteOrder,
        isAired,
        airDate,
      });
    }
  }

  return allEpisodes;
}
