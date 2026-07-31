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

  const { movieId } = req.query;
  if (!movieId) {
    return sendError(res, 400, "invalid-argument", "Movie ID is required");
  }

  const cacheKey = `movie_details_${movieId}`;
  const cached = getCached(cacheKey);
  if (cached) {
    return res.status(200).json(cached);
  }

  try {
    const tmdbToken = process.env.TMDB_READ_ACCESS_TOKEN;
    if (!tmdbToken) {
      return sendError(res, 500, "internal", "TMDB API key not configured");
    }

    const url = `https://api.themoviedb.org/3/movie/${movieId}?append_to_response=external_ids,images,credits,videos&include_image_language=en,null`;
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
        "Failed to fetch Movie details",
      );
    }

    const data = await response.json();

    const normalized = {
      id: data.id,
      title: data.title,
      name: data.title, // mirror TV name field
      overview: data.overview,
      posterPath: data.poster_path,
      backdropPath: data.backdrop_path,
      releaseDate: data.release_date,
      status: data.status,
      runtime: data.runtime,
      genres: data.genres?.map((g) => ({ id: g.id, name: g.name })) || [],
      voteAverage: data.vote_average,
      voteCount: data.vote_count,
      logos:
        data.images?.logos?.map((l) => ({
          filePath: l.file_path,
          aspectRatio: l.aspect_ratio,
        })) || [],
      imdbId: data.external_ids?.imdb_id || data.imdb_id || null,
      credits: data.credits || null,
      videos: data.videos || null,
    };

    if (normalized.imdbId) {
      try {
        const imdbBase = process.env.IMDB_API_BASE_URL || process.env.VITE_IMDB_BASE_URL;
        if (imdbBase) {
          const imdbUrl = `${imdbBase.replace(/\/$/, "")}/titles/${normalized.imdbId}`;
          const imdbRes = await fetchWithTimeout(imdbUrl, {}, 8000);
          if (imdbRes.ok) {
            const imdbData = await imdbRes.json();
            normalized.imdbRating =
              imdbData?.rating?.aggregateRating || imdbData?.rating || null;
            normalized.imdbVotes =
              imdbData?.rating?.voteCount || imdbData?.votes || null;
          }
        }
      } catch (imdbError) {
        console.warn(
          "IMDb fetch failed, continuing without IMDb data",
          imdbError,
        );
      }
    }

    setCache(cacheKey, normalized);
    return res.status(200).json(normalized);
  } catch (error) {
    console.error("Error fetching Movie details:", error);
    return sendError(res, 500, "internal", "Internal server error");
  }
}
