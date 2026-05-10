import * as functions from 'firebase-functions';
import { fetchWithTimeout } from '../utils/net';
import { getCached, setCache } from '../services/tvCache';

export const getTvDetails = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const tvId = req.path.split('/').pop();
  if (!tvId) {
    res.status(400).json({ error: 'TV ID is required' });
    return;
  }

  const cacheKey = `tv_details_${tvId}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.status(200).json(cached);
    return;
  }

  try {
    const tmdbApiKey = process.env.TMDB_API_KEY;
    if (!tmdbApiKey) {
      res.status(500).json({ error: 'TMDB API key not configured' });
      return;
    }

    const url = `https://api.themoviedb.org/3/tv/${tvId}?api_key=${tmdbApiKey}&append_to_response=external_ids,images&include_image_language=en,null`;
    const response = await fetchWithTimeout(url, {}, 15000);

    if (!response.ok) {
      res.status(response.status).json({ error: 'Failed to fetch TV show details' });
      return;
    }

    const data: any = await response.json();

    const normalized: any = {
      id: data.id,
      name: data.name,
      overview: data.overview,
      posterPath: data.poster_path,
      backdropPath: data.backdrop_path,
      firstAirDate: data.first_air_date,
      lastAirDate: data.last_air_date,
      status: data.status,
      numberOfSeasons: data.number_of_seasons,
      numberOfEpisodes: data.number_of_episodes,
      genres: data.genres?.map((g: any) => ({ id: g.id, name: g.name })) || [],
      networks: data.networks?.map((n: any) => ({ id: n.id, name: n.name, logoPath: n.logo_path })) || [],
      voteAverage: data.vote_average,
      voteCount: data.vote_count,
      logos: data.images?.logos?.map((l: any) => ({ filePath: l.file_path, aspectRatio: l.aspect_ratio })) || [],
      imdbId: data.external_ids?.imdb_id || null,
    };

    if (normalized.imdbId) {
      try {
        const imdbBase = process.env.IMDB_API_BASE_URL;
        if (imdbBase) {
          const imdbUrl = `${imdbBase.replace(/\/$/, '')}/titles/${normalized.imdbId}`;
          const imdbRes = await fetchWithTimeout(imdbUrl, {}, 8000);
          if (imdbRes.ok) {
            const imdbData: any = await imdbRes.json();
            normalized.imdbRating = imdbData?.rating?.aggregateRating || imdbData?.rating || null;
            normalized.imdbVotes = imdbData?.rating?.voteCount || imdbData?.votes || null;
          }
        }
      } catch (imdbError) {
        console.warn('IMDb fetch failed, continuing without IMDb data', imdbError);
      }
    }

    setCache(cacheKey, normalized);
    res.status(200).json(normalized);
  } catch (error) {
    console.error('Error fetching TV details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const getTvSeasons = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const pathParts = req.path.split('/').filter(Boolean);
  const tvId = pathParts[pathParts.length - 2];

  if (!tvId) {
    res.status(400).json({ error: 'TV ID is required' });
    return;
  }

  const cacheKey = `tv_seasons_${tvId}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.status(200).json(cached);
    return;
  }

  try {
    const tmdbApiKey = process.env.TMDB_API_KEY;
    if (!tmdbApiKey) {
      res.status(500).json({ error: 'TMDB API key not configured' });
      return;
    }

    const url = `https://api.themoviedb.org/3/tv/${tvId}?api_key=${tmdbApiKey}`;
    const response = await fetchWithTimeout(url, {}, 15000);

    if (!response.ok) {
      res.status(response.status).json({ error: 'Failed to fetch TV show' });
      return;
    }

    const data: any = await response.json();
    const seasons = data.seasons?.map((s: any) => ({
      id: s.id,
      name: s.name,
      seasonNumber: s.season_number,
      episodeCount: s.episode_count,
      airDate: s.air_date,
      posterPath: s.poster_path,
    })) || [];

    setCache(cacheKey, seasons);
    res.status(200).json(seasons);
  } catch (error) {
    console.error('Error fetching TV seasons:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const getTvSeasonEpisodes = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const pathParts = req.path.split('/').filter(Boolean);
  const tvId = pathParts[pathParts.length - 3];
  const seasonNumber = pathParts[pathParts.length - 1];

  if (!tvId || !seasonNumber) {
    res.status(400).json({ error: 'TV ID and season number are required' });
    return;
  }

  const cacheKey = `tv_season_${tvId}_${seasonNumber}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.status(200).json(cached);
    return;
  }

  try {
    const tmdbApiKey = process.env.TMDB_API_KEY;
    if (!tmdbApiKey) {
      res.status(500).json({ error: 'TMDB API key not configured' });
      return;
    }

    const url = `https://api.themoviedb.org/3/tv/${tvId}/season/${seasonNumber}?api_key=${tmdbApiKey}`;
    const response = await fetchWithTimeout(url, {}, 15000);

    if (!response.ok) {
      res.status(response.status).json({ error: 'Failed to fetch season episodes' });
      return;
    }

    const data: any = await response.json();
    const normalized = {
      seasonNumber: data.season_number,
      name: data.name,
      overview: data.overview,
      airDate: data.air_date,
      episodes: data.episodes?.map((ep: any) => ({
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
    res.status(200).json(normalized);
  } catch (error) {
    console.error('Error fetching season episodes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export const getTvVideos = functions.https.onRequest(async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const pathParts = req.path.split('/').filter(Boolean);
  const tvId = pathParts[pathParts.length - 2];

  if (!tvId) {
    res.status(400).json({ error: 'TV ID is required' });
    return;
  }

  const cacheKey = `tv_videos_${tvId}`;
  const cached = getCached(cacheKey);
  if (cached) {
    res.status(200).json(cached);
    return;
  }

  try {
    const tmdbApiKey = process.env.TMDB_API_KEY;
    if (!tmdbApiKey) {
      res.status(500).json({ error: 'TMDB API key not configured' });
      return;
    }

    const url = `https://api.themoviedb.org/3/tv/${tvId}/videos?api_key=${tmdbApiKey}`;
    const response = await fetchWithTimeout(url, {}, 15000);

    if (!response.ok) {
      res.status(response.status).json({ error: 'Failed to fetch videos' });
      return;
    }

    const data: any = await response.json();
    const videos = data.results?.map((v: any) => ({
      id: v.id,
      key: v.key,
      name: v.name,
      site: v.site,
      type: v.type,
      official: v.official,
    })) || [];

    setCache(cacheKey, videos);
    res.status(200).json(videos);
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
