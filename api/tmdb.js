import { sendError } from "./_lib/utils.js";

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return sendError(res, 405, "method-not-allowed", "Method not allowed");
  }

  // Expecting a query parameter 'endpoint' like '/movie/123'
  const { endpoint, ...params } = req.method === "GET" ? req.query : req.body;

  if (!endpoint || typeof endpoint !== "string") {
    return sendError(
      res,
      400,
      "invalid-argument",
      "Missing endpoint parameter",
    );
  }

  const API_BASE_URL = "https://api.themoviedb.org/3";
  const TMDB_API_KEY = process.env.TMDB_API_KEY || process.env.VITE_TMDB_KEY;

  if (!TMDB_API_KEY) {
    return sendError(
      res,
      500,
      "internal",
      "TMDB API key not configured on server",
    );
  }

  try {
    const url = new URL(`${API_BASE_URL}${endpoint}`);
    url.searchParams.append("api_key", TMDB_API_KEY);
    Object.keys(params).forEach((key) => {
      url.searchParams.append(key, params[key]);
    });

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        accept: "application/json",
      },
    });

    if (!response.ok) {
      return res
        .status(response.status)
        .json({ error: `TMDB API error: ${response.status}` });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error(`Error proxying TMDB request to ${endpoint}:`, error);
    return sendError(
      res,
      500,
      "internal",
      "Internal server error while proxying to TMDB",
    );
  }
}
