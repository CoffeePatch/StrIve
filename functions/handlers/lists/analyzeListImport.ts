import * as functions from 'firebase-functions';
import * as Papa from 'papaparse';
import Busboy from 'busboy';
import { fetchWithTimeout, pLimit } from '../../utils/net';
import {
  extractListIdFromPath,
  HttpRequestError,
  requireUidFromAuthHeader,
  resolveListItemsCollection,
} from './common';

interface AnalysisResult {
  matched: Array<{
    movie: {
      id: number;
      title: string;
      release_date?: string;
      first_air_date?: string;
      media_type: 'movie' | 'tv';
      poster_path?: string;
    };
    originalRow: any;
  }>;
  unmatched: Array<{
    row: any;
    reason: string;
  }>;
  duplicates: Array<{
    movie: {
      id: number;
      title: string;
      release_date?: string;
      first_air_date?: string;
      media_type: 'movie' | 'tv';
      poster_path?: string;
    };
    originalRow: any;
  }>;
}

export const analyzeListImport = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const listId = extractListIdFromPath(req.path, 'import_analyze');
    const uid = await requireUidFromAuthHeader(req.headers.authorization);
    const itemsCollectionRef = await resolveListItemsCollection(uid, listId);

    const contentType = (req.headers['content-type'] || req.headers['Content-Type']) as string | undefined;
    if (!contentType || !contentType.includes('multipart/form-data')) {
      res.status(400).json({ error: 'Content-Type must be multipart/form-data' });
      return;
    }

    const EXPECTED_HEADERS = ['tmdbId', 'imdbId', 'name', 'year', 'mediaType', 'tmdbRating', 'imdbRating', 'tmdbVotes', 'imdbVotes'];
    const busboy = Busboy({ headers: req.headers });
    let csvBuffer: Buffer | null = null;
    let fileCount = 0;

    busboy.on('file', (_fieldname: string, file: any, info: any) => {
      const { filename, mimeType } = info;
      if (mimeType === 'text/csv' || (filename && filename.endsWith('.csv'))) {
        fileCount++;
        const buffers: Buffer[] = [];
        file.on('data', (data: Buffer) => buffers.push(data));
        file.on('end', () => {
          csvBuffer = Buffer.concat(buffers);
        });
      } else {
        file.resume();
      }
    });

    busboy.on('finish', async () => {
      if (!csvBuffer || fileCount !== 1) {
        res.status(400).json({ error: 'Exactly one CSV file is required' });
        return;
      }

      try {
        const csvString = csvBuffer.toString('utf8');
        const parsed: any = Papa.parse(csvString, { header: true, skipEmptyLines: true });
        const fields: string[] = parsed?.meta?.fields || [];

        if (fields.length !== EXPECTED_HEADERS.length || !fields.every((f, i) => f === EXPECTED_HEADERS[i])) {
          if (fields.includes('Letterboxd URI') || fields.includes('Name') || (fields.includes('Year') && !fields.includes('year'))) {
            res.status(400).json({ error: 'Legacy CSV headers detected. Expected: ' + EXPECTED_HEADERS.join(',') });
            return;
          }
          res.status(400).json({ error: 'Invalid CSV headers. Expected exact columns: ' + EXPECTED_HEADERS.join(',') });
          return;
        }

        const existingSnapshot = await itemsCollectionRef.get();
        const existingById = new Map<string, any>();
        const existingByNameYear = new Set<string>();
        existingSnapshot.docs.forEach((d: any) => {
          const it = d.data();
          if (it?.id) existingById.set(String(it.id), it);
          const n = (it?.title || it?.name || '').trim();
          const y = (it?.release_date || it?.first_air_date || '').slice(0, 4);
          if (n && y) existingByNameYear.add(`${n}::${y}`);
        });

        const tmdbApiKey = process.env.TMDB_API_KEY;
        const limit = pLimit(6);

        async function tmdbFindByImdb(imdbId: string, mt: 'movie' | 'tv'): Promise<any | null> {
          if (!tmdbApiKey || !imdbId) return null;
          const url = `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?api_key=${tmdbApiKey}&external_source=imdb_id`;
          try {
            const r = await fetchWithTimeout(url, {}, 8000);
            if (!r.ok) return null;
            const j: any = await r.json();
            const arr = mt === 'movie' ? j?.movie_results : j?.tv_results;
            return Array.isArray(arr) && arr[0] ? arr[0] : null;
          } catch {
            return null;
          }
        }

        async function tmdbSearchByNameYear(name: string, year: string, mt: 'movie' | 'tv'): Promise<any | null> {
          if (!tmdbApiKey || !name) return null;
          const base = `https://api.themoviedb.org/3/search/${mt}`;
          const q = new URLSearchParams({ api_key: String(tmdbApiKey), query: name });
          if (year) q.set(mt === 'movie' ? 'year' : 'first_air_date_year', year);
          const url = `${base}?${q.toString()}`;
          try {
            const r = await fetchWithTimeout(url, {}, 8000);
            if (!r.ok) return null;
            const j: any = await r.json();
            return Array.isArray(j?.results) && j.results[0] ? j.results[0] : null;
          } catch {
            return null;
          }
        }

        async function tmdbDetails(mt: 'movie' | 'tv', id: string | number): Promise<any | null> {
          if (!tmdbApiKey || !id) return null;
          const url = `https://api.themoviedb.org/3/${mt}/${id}?api_key=${tmdbApiKey}`;
          try {
            const r = await fetchWithTimeout(url, {}, 8000);
            if (!r.ok) return null;
            return await r.json();
          } catch {
            return null;
          }
        }

        const rows: any[] = parsed.data as any[];
        const result: AnalysisResult = { matched: [], unmatched: [], duplicates: [] };

        await Promise.all(rows.map((row) => limit(async () => {
          const tmdbIdRaw = String(row.tmdbId || '').trim();
          const imdbIdRaw = String(row.imdbId || '').trim();
          const name = String(row.name || '').trim();
          const year = String(row.year || '').trim();
          const mt = String(row.mediaType || '').trim() === 'tv' ? 'tv' : 'movie';

          if (tmdbIdRaw && existingById.has(tmdbIdRaw)) {
            const it = existingById.get(tmdbIdRaw);
            result.duplicates.push({ movie: { id: it.id, title: it.title || it.name, release_date: it.release_date, first_air_date: it.first_air_date, media_type: it.media_type, poster_path: it.poster_path }, originalRow: row });
            return;
          }

          if (!tmdbIdRaw && name && year && existingByNameYear.has(`${name}::${year}`)) {
            const it = [...existingById.values()].find((v: any) => (v.title || v.name) === name && (v.release_date || v.first_air_date || '').startsWith(year));
            if (it) {
              result.duplicates.push({ movie: { id: it.id, title: it.title || it.name, release_date: it.release_date, first_air_date: it.first_air_date, media_type: it.media_type, poster_path: it.poster_path }, originalRow: row });
              return;
            }
          }

          let resolved: any = null;
          if (tmdbIdRaw) {
            resolved = await tmdbDetails(mt, tmdbIdRaw);
          } else if (imdbIdRaw) {
            const found = await tmdbFindByImdb(imdbIdRaw, mt);
            if (found?.id) resolved = await tmdbDetails(mt, found.id);
          } else if (name) {
            const found = await tmdbSearchByNameYear(name, year, mt);
            if (found?.id) resolved = await tmdbDetails(mt, found.id);
          }

          if (resolved?.id) {
            result.matched.push({ movie: { id: resolved.id, title: resolved.title || resolved.name, release_date: resolved.release_date, first_air_date: resolved.first_air_date, media_type: mt, poster_path: resolved.poster_path }, originalRow: row });
          } else {
            result.unmatched.push({ row, reason: 'Not found in TMDB' });
          }
        })));

        res.status(200).json(result);
      } catch (parseError) {
        console.error('Error parsing CSV:', parseError);
        res.status(400).json({ error: 'Invalid CSV format' });
      }
    });

    req.pipe(busboy);
  } catch (error) {
    if (error instanceof HttpRequestError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error('Error analyzing CSV for import:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
