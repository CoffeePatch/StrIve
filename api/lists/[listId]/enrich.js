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

          const mediaType = item.mediaType === "tv" || item.media_type === "tv" ? "tv" : "movie";

          const updates = {};
          let hasTmdbData = false;
          let hasImdbData = false;

          if (item.tmdbId || item.id) {
            try {
              const tmdbData = await fetchTmdbDetails(
                mediaType,
                item.tmdbId || item.id,
                tmdbToken,
              );

              if (tmdbData) {
                hasTmdbData = true;
                updates["ratings.tmdbScore"] = typeof tmdbData.vote_average === "number" ? tmdbData.vote_average : null;
                updates["ratings.tmdbVotes"] = typeof tmdbData.vote_count === "number" ? tmdbData.vote_count : null;
                updates["images.tmdbPoster"] = tmdbData.poster_path || item?.images?.tmdbPoster || null;
                updates.releaseDate = tmdbData.release_date || tmdbData.first_air_date || item.releaseDate || null;
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
                updates["ratings.imdbScore"] = imdbData.rating;
                updates["ratings.imdbVotes"] = imdbData.votes || null;
              }
            } catch (error) {
              console.error(`IMDb fetch failed for ${item.title}:`, error);
            }
          }

          if (hasTmdbData || hasImdbData) {
            updates.enrichmentStatus = "enriched";
            updates["tracking.updatedAt"] = admin.firestore.FieldValue.serverTimestamp();
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
