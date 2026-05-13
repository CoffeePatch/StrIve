"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTvVideos = exports.getTvSeasonEpisodes = exports.getTvSeasons = exports.getTvDetails = void 0;
const functions = __importStar(require("firebase-functions"));
const net_1 = require("../utils/net");
const tvCache_1 = require("../services/tvCache");
exports.getTvDetails = functions.https.onRequest(async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g;
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
    const cached = (0, tvCache_1.getCached)(cacheKey);
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
        const response = await (0, net_1.fetchWithTimeout)(url, {}, 15000);
        if (!response.ok) {
            res.status(response.status).json({ error: 'Failed to fetch TV show details' });
            return;
        }
        const data = await response.json();
        const normalized = {
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
            genres: ((_a = data.genres) === null || _a === void 0 ? void 0 : _a.map((g) => ({ id: g.id, name: g.name }))) || [],
            networks: ((_b = data.networks) === null || _b === void 0 ? void 0 : _b.map((n) => ({ id: n.id, name: n.name, logoPath: n.logo_path }))) || [],
            voteAverage: data.vote_average,
            voteCount: data.vote_count,
            logos: ((_d = (_c = data.images) === null || _c === void 0 ? void 0 : _c.logos) === null || _d === void 0 ? void 0 : _d.map((l) => ({ filePath: l.file_path, aspectRatio: l.aspect_ratio }))) || [],
            imdbId: ((_e = data.external_ids) === null || _e === void 0 ? void 0 : _e.imdb_id) || null,
        };
        if (normalized.imdbId) {
            try {
                const imdbBase = process.env.IMDB_API_BASE_URL;
                if (imdbBase) {
                    const imdbUrl = `${imdbBase.replace(/\/$/, '')}/titles/${normalized.imdbId}`;
                    const imdbRes = await (0, net_1.fetchWithTimeout)(imdbUrl, {}, 8000);
                    if (imdbRes.ok) {
                        const imdbData = await imdbRes.json();
                        normalized.imdbRating = ((_f = imdbData === null || imdbData === void 0 ? void 0 : imdbData.rating) === null || _f === void 0 ? void 0 : _f.aggregateRating) || (imdbData === null || imdbData === void 0 ? void 0 : imdbData.rating) || null;
                        normalized.imdbVotes = ((_g = imdbData === null || imdbData === void 0 ? void 0 : imdbData.rating) === null || _g === void 0 ? void 0 : _g.voteCount) || (imdbData === null || imdbData === void 0 ? void 0 : imdbData.votes) || null;
                    }
                }
            }
            catch (imdbError) {
                console.warn('IMDb fetch failed, continuing without IMDb data', imdbError);
            }
        }
        (0, tvCache_1.setCache)(cacheKey, normalized);
        res.status(200).json(normalized);
    }
    catch (error) {
        console.error('Error fetching TV details:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.getTvSeasons = functions.https.onRequest(async (req, res) => {
    var _a;
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
    const cached = (0, tvCache_1.getCached)(cacheKey);
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
        const response = await (0, net_1.fetchWithTimeout)(url, {}, 15000);
        if (!response.ok) {
            res.status(response.status).json({ error: 'Failed to fetch TV show' });
            return;
        }
        const data = await response.json();
        const seasons = ((_a = data.seasons) === null || _a === void 0 ? void 0 : _a.map((s) => ({
            id: s.id,
            name: s.name,
            seasonNumber: s.season_number,
            episodeCount: s.episode_count,
            airDate: s.air_date,
            posterPath: s.poster_path,
        }))) || [];
        (0, tvCache_1.setCache)(cacheKey, seasons);
        res.status(200).json(seasons);
    }
    catch (error) {
        console.error('Error fetching TV seasons:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.getTvSeasonEpisodes = functions.https.onRequest(async (req, res) => {
    var _a;
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
    const cached = (0, tvCache_1.getCached)(cacheKey);
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
        const response = await (0, net_1.fetchWithTimeout)(url, {}, 15000);
        if (!response.ok) {
            res.status(response.status).json({ error: 'Failed to fetch season episodes' });
            return;
        }
        const data = await response.json();
        const normalized = {
            seasonNumber: data.season_number,
            name: data.name,
            overview: data.overview,
            airDate: data.air_date,
            episodes: ((_a = data.episodes) === null || _a === void 0 ? void 0 : _a.map((ep) => ({
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
            }))) || [],
        };
        (0, tvCache_1.setCache)(cacheKey, normalized);
        res.status(200).json(normalized);
    }
    catch (error) {
        console.error('Error fetching season episodes:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.getTvVideos = functions.https.onRequest(async (req, res) => {
    var _a;
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
    const cached = (0, tvCache_1.getCached)(cacheKey);
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
        const response = await (0, net_1.fetchWithTimeout)(url, {}, 15000);
        if (!response.ok) {
            res.status(response.status).json({ error: 'Failed to fetch videos' });
            return;
        }
        const data = await response.json();
        const videos = ((_a = data.results) === null || _a === void 0 ? void 0 : _a.map((v) => ({
            id: v.id,
            key: v.key,
            name: v.name,
            site: v.site,
            type: v.type,
            official: v.official,
        }))) || [];
        (0, tvCache_1.setCache)(cacheKey, videos);
        res.status(200).json(videos);
    }
    catch (error) {
        console.error('Error fetching videos:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
//# sourceMappingURL=tvHttp.js.map