import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { pLimit } from '../../utils/net';
import { fetchImdbRatings, fetchTmdbDetails } from '../../services/enrichment';
import {
  extractListIdFromPath,
  HttpRequestError,
  requireUidFromAuthHeader,
  resolveListItemsCollection,
} from './common';

export const enrichList = functions.https.onRequest(async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const listId = extractListIdFromPath(req.path, 'enrich');
    const uid = await requireUidFromAuthHeader(req.headers.authorization);
    const itemsCollectionRef = await resolveListItemsCollection(uid, listId);

    res.status(202).json({
      success: true,
      message: 'Enrichment started in background. Check back later for results.',
    });

    const itemsSnapshot = await itemsCollectionRef.get();
    if (itemsSnapshot.empty) return;

    const tmdbApiKey = process.env.TMDB_API_KEY;
    const imdbApiBase = process.env.IMDB_API_BASE_URL;
    const limit = pLimit(3);

    await Promise.all(itemsSnapshot.docs.map((doc: any) => limit(async () => {
      const item = doc.data();
      if (item.enrichmentStatus === 'enriched') return;

      const updates: any = {};
      let hasTmdbData = false;
      let hasImdbData = false;

      if (item.tmdbId) {
        try {
          const mediaType = item.media_type === 'tv' ? 'tv' : 'movie';
          const tmdbData = await fetchTmdbDetails(mediaType, item.tmdbId, tmdbApiKey);

          if (tmdbData) {
            hasTmdbData = true;
            updates.tmdb_rating = tmdbData.vote_average || null;
            updates.tmdb_vote_count = tmdbData.vote_count || null;
            updates.overview = tmdbData.overview || null;
            updates.backdrop_path = tmdbData.backdrop_path || null;

            console.log(`✓ TMDB enriched: ${item.title} - Rating: ${updates.tmdb_rating}`);
          }
        } catch (error) {
          console.error(`TMDB fetch failed for ${item.title}:`, error);
        }
      }

      if (item.imdbId && imdbApiBase) {
        try {
          const imdbData = await fetchImdbRatings(item.imdbId);
          if (imdbData?.rating) {
            hasImdbData = true;
            updates.imdb_rating = imdbData.rating;
            updates.imdb_vote_count = imdbData.votes || null;
            console.log(`✓ IMDb enriched: ${item.title} - Rating: ${updates.imdb_rating}`);
          }
        } catch (error) {
          console.error(`IMDb fetch failed for ${item.title}:`, error);
        }
      }

      if (hasTmdbData || hasImdbData) {
        updates.vote_average = updates.imdb_rating || updates.tmdb_rating || null;
        updates.vote_count = updates.imdb_vote_count || updates.tmdb_vote_count || null;
        updates.enrichmentStatus = 'enriched';
        updates.lastEnriched = admin.firestore.FieldValue.serverTimestamp();

        await doc.ref.update(updates);
        console.log(`✓ Enriched ${item.title} successfully`);
      } else {
        await doc.ref.update({
          enrichmentStatus: 'failed',
          lastEnriched: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`✗ No data found for ${item.title}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
    })));

    console.log(`✅ Enrichment complete for list ${listId}`);
  } catch (error) {
    if (error instanceof HttpRequestError) {
      if (!res.headersSent) {
        res.status(error.status).json({ error: error.message });
      }
      return;
    }

    console.error('Error in background enrichment:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});
