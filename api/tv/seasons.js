import {
  fetchWithTimeout,
  getCached,
  setCache,
  sendError,
} from "../_lib/utils.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendError(res, 405, "method-not-allowed", "Method not allowed");
  }

  const { tvId } = req.query;
  if (!tvId) {
    return sendError(res, 400, "invalid-argument", "TV ID is required");
  }

  const cacheKey = `tv_seasons_${tvId}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.status(200).json(cached);
  }

  try {
    const tmdbToken = process.env.TMDB_READ_ACCESS_TOKEN;
    if (!tmdbToken) {
      return sendError(res, 500, "internal", "TMDB API key not configured");
    }

    const url = `https://api.themoviedb.org/3/tv/${tvId}`;
    const response = await fetchWithTimeout(
      url,
      {
        headers: {
          accept: "application/json",
          Authorization: `Bearer ${tmdbToken}`,
        },
      },
      15000,
    );

    if (!response.ok) {
      return sendError(
        res,
        response.status,
        "failed",
        "Failed to fetch TV show",
      );
    }

    const data = await response.json();
    const seasons =
      data.seasons?.map((s) => ({
        id: s.id,
        name: s.name,
        seasonNumber: s.season_number,
        episodeCount: s.episode_count,
        airDate: s.air_date,
        posterPath: s.poster_path,
      })) || [];

    setCache(cacheKey, seasons);
    return res.status(200).json(seasons);
  } catch (error) {
    console.error("Error fetching TV seasons:", error);
    return sendError(res, 500, "internal", "Internal server error");
  }
}
