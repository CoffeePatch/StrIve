import { db, admin } from "../../../../_lib/firebaseAdmin.js";
import { fetchWithTimeout, sendError } from "../../../../_lib/utils.js";
import {
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

    const { moviesToImport } = req.body || {};
    if (!Array.isArray(moviesToImport)) {
      return sendError(
        res,
        400,
        "invalid-argument",
        "Request body must contain an array of moviesToImport",
      );
    }

    if (moviesToImport.length === 0) {
      return res
        .status(201)
        .json({
          success: true,
          moviesAdded: 0,
          message: "No movies to import",
        });
    }

    const itemsCollectionRef = await resolveListItemsCollection(uid, listId);

    const existingSnapshot = await itemsCollectionRef.get();
    const existing = new Set(
      existingSnapshot.docs.map((d) => String((d.data() || {}).id)),
    );
    const tmdbToken = process.env.TMDB_READ_ACCESS_TOKEN;

    async function fetchDetailsTryBoth(id) {
      if (!tmdbToken) return { ok: false };
      const mUrl = `https://api.themoviedb.org/3/movie/${id}`;
      const tUrl = `https://api.themoviedb.org/3/tv/${id}`;
      try {
        const r = await fetchWithTimeout(
          mUrl,
          { headers: { Authorization: `Bearer ${tmdbToken}` } },
          8000,
        );
        if (r.ok) {
          const j = await r.json();
          return { ok: true, data: j, media_type: "movie" };
        }
      } catch {}
      try {
        const r = await fetchWithTimeout(
          tUrl,
          { headers: { Authorization: `Bearer ${tmdbToken}` } },
          8000,
        );
        if (r.ok) {
          const j = await r.json();
          return { ok: true, data: j, media_type: "tv" };
        }
      } catch {}
      return { ok: false };
    }

    const batch = db.batch();
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
    return res
      .status(201)
      .json({
        success: true,
        moviesAdded,
        message: `${moviesAdded} movies successfully added to the list`,
      });
  } catch (error) {
    if (error instanceof HttpRequestError) {
      return sendError(res, error.status, "failed", error.message);
    }
    console.error("Error confirming list import:", error);
    return sendError(res, 500, "internal", "Internal server error");
  }
}
