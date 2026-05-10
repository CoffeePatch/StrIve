import * as functions from 'firebase-functions';
import { escapeCsvField } from '../../utils/csv';
import { pLimit } from '../../utils/net';
import { enrichItem, EnrichedItem } from '../../services/enrichment';
import {
  extractListIdFromPath,
  HttpRequestError,
  requireUidFromAuthHeader,
  resolveListExportContext,
} from './common';

export const listsExport = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const listId = extractListIdFromPath(req.path, 'export');
    const authHeader = req.headers.authorization || req.headers.Authorization;
    const uid = await requireUidFromAuthHeader(authHeader);
    const { itemsCollectionRef, listName } = await resolveListExportContext(uid, listId);
    const itemsSnapshot = await itemsCollectionRef.get();

    if (!itemsSnapshot || itemsSnapshot.empty) {
      res.set('Cache-Control', 'no-cache');
      res.status(204).end();
      return;
    }

    const tmdbApiKey = process.env.TMDB_API_KEY;
    const limit = pLimit(8);
    const enriched: EnrichedItem[] = await Promise.all(
      (itemsSnapshot.docs as any[])
        .map((d: any) => d.data())
        .map((item: any) => limit(() => enrichItem(item, tmdbApiKey)))
    );

    const header = 'tmdbId,imdbId,name,year,mediaType,tmdbRating,imdbRating,tmdbVotes,imdbVotes';
    const rows = enriched.map((r) => [
      escapeCsvField(String(r.tmdbId ?? '')),
      escapeCsvField(r.imdbId || ''),
      escapeCsvField(r.name || ''),
      escapeCsvField(r.year || ''),
      escapeCsvField(r.mediaType || ''),
      escapeCsvField(r.tmdbRating || ''),
      escapeCsvField(r.imdbRating || ''),
      escapeCsvField(r.tmdbVotes || ''),
      escapeCsvField(r.imdbVotes || ''),
    ].join(','));

    const csv = [header, ...rows].join('\n');

    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, '0');
    const d = String(now.getUTCDate()).padStart(2, '0');
    const dateStr = `${y}${m}${d}`;
    const safeName = listName.replace(/[\n\r]/g, ' ').trim();
    const filename = `${safeName}-${dateStr}.csv`;

    res.set('Content-Type', 'text/csv');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.set('Cache-Control', 'no-cache');
    res.status(200).send(csv);
  } catch (error) {
    if (error instanceof HttpRequestError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error('Error exporting list CSV:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
