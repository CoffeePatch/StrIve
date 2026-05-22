import { db, admin } from "../../../../_lib/firebaseAdmin.js";
import { pLimit, sendError } from "../../../../_lib/utils.js";
import {
  fetchImdbRatings,
  fetchTmdbDetails,
  resolveListItemsCollection,
  HttpRequestError,
  requireUidFromAuthHeader,
} from "../../../../_lib/listUtils.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendError(res, 405, "method-not-allowed", "Method not allowed");
  }

  try {
    const { listId } = req.query;
    if (!listId) {
      return sendError(res, 400, "invalid-argument", "List ID is required");
    }

    const uid = await requireUidFromAuthHeader(req.headers.authorization);
    const itemsCollectionRef = await resolveListItemsCollection(uid, listId);

    const itemsSnapshot = await itemsCollectionRef.get();
    if (itemsSnapshot.empty) {
      return res
        .status(200)
        .json({ success: true, message: "No items to enrich" });
    }

    const tmdbToken = process.env.TMDB_READ_ACCESS_TOKEN;
    const limit = pLimit(10); // increased concurrency to finish faster on Vercel
    const MAX_EXECUTION_TIME = 8000; // 8 seconds to stay within Vercel 10s limit
    const startTime = Date.now();
    let enrichedCount = 0;

    await Promise.all(
      itemsSnapshot.docs.map((doc) =>
        limit(async () => {
          // Abort if approaching Vercel timeout
          if (Date.now() - startTime > MAX_EXECUTION_TIME) return;

          const item = doc.data();
          if (item.enrichmentStatus === "enriched") return;

          const updates = {};
          let hasTmdbData = false;
          let hasImdbData = false;

          if (item.tmdbId) {
            try {
              const mediaType = item.media_type === "tv" ? "tv" : "movie";
              const tmdbData = await fetchTmdbDetails(
                mediaType,
                item.tmdbId,
                tmdbToken,
              );

              if (tmdbData) {
                hasTmdbData = true;
                updates.tmdb_rating = tmdbData.vote_average || null;
                updates.tmdb_vote_count = tmdbData.vote_count || null;
                updates.overview = tmdbData.overview || null;
                updates.backdrop_path = tmdbData.backdrop_path || null;
              }
            } catch (error) {
              console.error(`TMDB fetch failed for ${item.title}:`, error);
            }
          }

          if (item.imdbId) {
            try {
              const imdbData = await fetchImdbRatings(item.imdbId);
              if (imdbData?.rating) {
                hasImdbData = true;
                updates.imdb_rating = imdbData.rating;
                updates.imdb_vote_count = imdbData.votes || null;
              }
            } catch (error) {
              console.error(`IMDb fetch failed for ${item.title}:`, error);
            }
          }

          if (hasTmdbData || hasImdbData) {
            updates.vote_average =
              updates.imdb_rating || updates.tmdb_rating || null;
            updates.vote_count =
              updates.imdb_vote_count || updates.tmdb_vote_count || null;
            updates.enrichmentStatus = "enriched";
            updates.lastEnriched = admin.firestore.FieldValue.serverTimestamp();

            await doc.ref.update(updates);
            enrichedCount++;
          } else {
            await doc.ref.update({
              enrichmentStatus: "failed",
              lastEnriched: admin.firestore.FieldValue.serverTimestamp(),
            });
          }
        }),
      ),
    );

    return res.status(200).json({
      success: true,
      message: `Enriched ${enrichedCount} items. (Note: this is limited by Vercel execution time).`,
    });
  } catch (error) {
    if (error instanceof HttpRequestError) {
      return sendError(res, error.status, "failed", error.message);
    }

    console.error("Error in enrichment:", error);
    return sendError(res, 500, "internal", "Internal server error");
  }
}
