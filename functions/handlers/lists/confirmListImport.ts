import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { fetchWithTimeout } from '../../utils/net';
import {
  extractListIdFromPath,
  HttpRequestError,
  requireUidFromAuthHeader,
  resolveListItemsCollection,
} from './common';

export const confirmListImport = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const listId = extractListIdFromPath(req.path, 'import_confirm');
    const uid = await requireUidFromAuthHeader(req.headers.authorization);

    const { moviesToImport } = req.body || {};
    if (!Array.isArray(moviesToImport)) {
      res.status(400).json({ error: 'Request body must contain an array of moviesToImport' });
      return;
    }

    if (moviesToImport.length === 0) {
      res.status(201).json({ success: true, moviesAdded: 0, message: 'No movies to import' });
      return;
    }

    const itemsCollectionRef = await resolveListItemsCollection(uid, listId);

    const existingSnapshot = await itemsCollectionRef.get();
    const existing = new Set(existingSnapshot.docs.map((d: any) => String((d.data() || {}).id)));
    const tmdbApiKey = process.env.TMDB_API_KEY;

    async function fetchDetailsTryBoth(id: string): Promise<{ ok: boolean; data?: any; media_type?: 'movie' | 'tv' }> {
      if (!tmdbApiKey) return { ok: false };
      const mUrl = `https://api.themoviedb.org/3/movie/${id}?api_key=${tmdbApiKey}`;
      const tUrl = `https://api.themoviedb.org/3/tv/${id}?api_key=${tmdbApiKey}`;
      try {
        const r = await fetchWithTimeout(mUrl, {}, 8000);
        if (r.ok) {
          const j = await r.json();
          return { ok: true, data: j, media_type: 'movie' };
        }
      } catch {}
      try {
        const r = await fetchWithTimeout(tUrl, {}, 8000);
        if (r.ok) {
          const j = await r.json();
          return { ok: true, data: j, media_type: 'tv' };
        }
      } catch {}
      return { ok: false };
    }

    const batch = admin.firestore().batch();
    let moviesAdded = 0;
    for (const rawId of moviesToImport) {
      const id = String(rawId);
      if (existing.has(id)) continue;
      const det = await fetchDetailsTryBoth(id);
      if (!det.ok || !det.data?.id) continue;

      const payload = {
        id: det.data.id,
        title: det.data.title || det.data.name,
        poster_path: det.data.poster_path,
        release_date: det.data.release_date || det.data.first_air_date,
        vote_average: det.data.vote_average,
        media_type: det.media_type,
        dateAdded: admin.firestore.FieldValue.serverTimestamp(),
      };

      const docRef = itemsCollectionRef.doc(String(det.data.id));
      batch.set(docRef, payload, { merge: true });
      moviesAdded++;
    }

    if (moviesAdded > 0) await batch.commit();
    res.status(201).json({ success: true, moviesAdded, message: `${moviesAdded} movies successfully added to the list` });
  } catch (error) {
    if (error instanceof HttpRequestError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    console.error('Error confirming list import:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});
