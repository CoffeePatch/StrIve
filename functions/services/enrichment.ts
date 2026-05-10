import { fetchWithTimeout } from '../utils/net';

export interface EnrichedItem {
  tmdbId: number | string;
  imdbId: string;
  name: string;
  year: string;
  mediaType: 'movie' | 'tv';
  tmdbRating: string;
  imdbRating: string;
  tmdbVotes: string;
  imdbVotes: string;
}

export async function fetchTmdbExternalIds(
  mediaType: 'movie' | 'tv',
  tmdbId: number | string,
  apiKey?: string
): Promise<{ imdb_id?: string } | null> {
  if (!apiKey) return null;
  const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/external_ids?api_key=${apiKey}`;
  try {
    const res = await fetchWithTimeout(url, {}, 8000);
    if (!res.ok) return null;
    return await (res.json() as Promise<any>);
  } catch {
    return null;
  }
}

export async function fetchTmdbDetails(
  mediaType: 'movie' | 'tv',
  tmdbId: number | string,
  apiKey?: string
): Promise<{ vote_average?: number; vote_count?: number; overview?: string; backdrop_path?: string } | null> {
  if (!apiKey) return null;
  const url = `https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${apiKey}`;
  try {
    const res = await fetchWithTimeout(url, {}, 8000);
    if (!res.ok) return null;
    return await (res.json() as Promise<any>);
  } catch {
    return null;
  }
}

export function getImdbApiBaseUrl(): string {
  const baseUrl = process.env.IMDB_API_BASE_URL;

  if (!baseUrl) {
    const errorMsg = 'IMDB_API_BASE_URL environment variable is not configured. IMDb ratings will be unavailable.';
    console.error(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }

  return baseUrl.replace(/\/$/, '');
}

export async function fetchImdbRatings(imdbId: string): Promise<{ rating?: number; votes?: number } | null> {
  if (!imdbId) return null;

  try {
    const base = getImdbApiBaseUrl();
    const url = `${base}/titles/${imdbId}`;
    const res = await fetchWithTimeout(url, {}, 8000);
    if (!res.ok) return null;
    const data: any = await res.json();
    const rating = data?.rating ?? data?.ratings?.imdb ?? data?.ratingAverage;
    const votes = data?.votes ?? data?.ratingsCount ?? data?.imdbVotes;
    return {
      rating: typeof rating === 'number' ? rating : (typeof rating === 'string' ? parseFloat(rating) : undefined),
      votes: typeof votes === 'number' ? votes : (typeof votes === 'string' ? parseInt(votes.replace(/[,]/g, ''), 10) : undefined),
    };
  } catch (err) {
    if (err instanceof Error && err.message.includes('IMDB_API_BASE_URL')) {
      console.warn('IMDb ratings unavailable - IMDB_API_BASE_URL not configured');
      return null;
    }
    console.error(`fetchImdbRatings error for ${imdbId}:`, err);
    return null;
  }
}

function deriveMediaType(item: any): 'movie' | 'tv' {
  if (item?.media_type === 'tv') return 'tv';
  if (item?.media_type === 'movie') return 'movie';
  if (item?.first_air_date) return 'tv';
  return 'movie';
}

function deriveName(item: any, mediaType: 'movie' | 'tv'): string {
  return mediaType === 'movie' ? (item?.title || item?.name || '') : (item?.name || item?.title || '');
}

function deriveYear(item: any, mediaType: 'movie' | 'tv'): string {
  const dateStr = mediaType === 'movie' ? (item?.release_date || item?.first_air_date) : (item?.first_air_date || item?.release_date);
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? '' : String(d.getUTCFullYear());
}

export async function enrichItem(item: any, tmdbApiKey?: string): Promise<EnrichedItem> {
  const tmdbId = item?.id ?? item?.tmdbId ?? item?.tmdb_id;
  const mediaType = deriveMediaType(item);
  const name = deriveName(item, mediaType);
  const year = deriveYear(item, mediaType);

  let imdbId = '';
  let tmdbRating = '';
  let tmdbVotes = '';
  let imdbRating = '';
  let imdbVotes = '';

  const [ext, details] = await Promise.all([
    fetchTmdbExternalIds(mediaType, tmdbId, tmdbApiKey),
    fetchTmdbDetails(mediaType, tmdbId, tmdbApiKey),
  ]);

  if (ext?.imdb_id) imdbId = ext.imdb_id;

  if (details) {
    const va = details.vote_average;
    const vc = details.vote_count;
    if (typeof va === 'number') tmdbRating = va.toFixed(1).replace(/\.0$/, '.0');
    if (typeof vc === 'number') tmdbVotes = String(vc);
  }

  if (!tmdbRating && typeof item?.vote_average === 'number') {
    tmdbRating = item.vote_average.toFixed(1).replace(/\.0$/, '.0');
  }
  if (!tmdbVotes && typeof item?.vote_count === 'number') {
    tmdbVotes = String(item.vote_count);
  }

  if (imdbId) {
    const imdb = await fetchImdbRatings(imdbId);
    if (imdb) {
      if (typeof imdb.rating === 'number') imdbRating = imdb.rating.toFixed(1).replace(/\.0$/, '.0');
      if (typeof imdb.votes === 'number') imdbVotes = String(imdb.votes);
    }
  }

  return { tmdbId, imdbId, name, year, mediaType, tmdbRating, imdbRating, tmdbVotes, imdbVotes };
}
