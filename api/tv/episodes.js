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

  const { tvId, season } = req.query;
  if (!tvId || !season) {
    return sendError(
      res,
      400,
      "invalid-argument",
      "TV ID and season number are required",
    );
  }

  const cacheKey = `tv_season_${tvId}_${season}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.status(200).json(cached);
  }

  try {
    const tmdbToken = process.env.TMDB_READ_ACCESS_TOKEN;
    if (!tmdbToken) {
      return sendError(res, 500, "internal", "TMDB API key not configured");
    }

    const url = `https://api.themoviedb.org/3/tv/${tvId}/season/${season}`;
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
        "Failed to fetch season episodes",
      );
    }

    const data = await response.json();
    const normalized = {
      seasonNumber: data.season_number,
      name: data.name,
      overview: data.overview,
      airDate: data.air_date,
      episodes:
        data.episodes?.map((ep) => ({
          id: ep.id,
          name: ep.name,
          episodeNumber: ep.episode_number,
          seasonNumber: ep.season_number,
          overview: ep.overview,
          stillPath: ep.still_path,
          airDate: ep.air_date,
          runtime: ep.runtime,
          voteAverage: ep.vote_average,
          voteCount: ep.vote_count,
        })) || [],
    };

    setCache(cacheKey, normalized);
    return res.status(200).json(normalized);
  } catch (error) {
    console.error("Error fetching season episodes:", error);
    return sendError(res, 500, "internal", "Internal server error");
  }
}
