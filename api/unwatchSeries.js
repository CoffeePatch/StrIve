import { db, admin } from "./_lib/firebaseAdmin.js";
import { verifyAuth } from "./_lib/authMiddleware.js";
import { parseTvTitleKey, sendError } from "./_lib/utils.js";
import { buildWatchCounters } from "./_lib/seriesProgress.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendError(res, 405, "method-not-allowed", "Only POST is allowed");
  }

  let decodedToken;
  try {
    decodedToken = await verifyAuth(req);
  } catch (err) {
    return sendError(res, 401, "unauthenticated", err.message);
  }
  const uid = decodedToken.uid;

  const payload = req.body || {};

  let titleKey;
  try {
    titleKey = parseTvTitleKey(payload.titleKey);
  } catch (err) {
    return sendError(res, 400, "invalid-argument", err.message);
  }

  const now = admin.firestore.Timestamp.now();

  try {
    // 1. Query all episode_states for this series
    const statesSnap = await db
      .collection("users")
      .doc(uid)
      .collection("episode_states")
      .where("titleKey", "==", titleKey)
      .get();

    const deletedCount = statesSnap.size;

    // 2. Batch-delete all episode_states
    if (!statesSnap.empty) {
      const MAX_BATCH = 500;
      for (let i = 0; i < statesSnap.docs.length; i += MAX_BATCH) {
        const chunk = statesSnap.docs.slice(i, i + MAX_BATCH);
        const batch = db.batch();
        for (const doc of chunk) {
          batch.delete(doc.ref);
        }
        await batch.commit();
      }
    }

    // 3. Reset series_progress and library_items in a transaction
    const progressRef = db
      .collection("users")
      .doc(uid)
      .collection("series_progress")
      .doc(titleKey);
    const libraryRef = db
      .collection("users")
      .doc(uid)
      .collection("library_items")
      .doc(titleKey);

    await db.runTransaction(async (tx) => {
      const [progressSnap, librarySnap] = await Promise.all([
        tx.get(progressRef),
        tx.get(libraryRef),
      ]);

      const progressData = progressSnap.exists ? progressSnap.data() || {} : {};
      const libraryData = librarySnap.exists ? librarySnap.data() || {} : {};

      // Preserve total/aired episode counts — only zero out watched stats
      const airedEpisodesCount = Number(progressData.airedEpisodesCount || 0);
      const totalEpisodesCount = Number(progressData.totalEpisodesCount || 0);
      const nextTracking = {
        ...(libraryData.tracking || {}),
        updatedAt: now,
        lastWatchedAt: null,
      };

      tx.set(
        progressRef,
        {
          titleKey,
          watchedEpisodesCount: 0,
          airedEpisodesCount,
          totalEpisodesCount,
          completionRatioAired: 0,
          completionRatioTotal: 0,
          lastWatchedEpisode: null,
          nextEpisode: null,
          progressNeedsRecompute: false,
          updatedAt: now,
        },
        { merge: true },
      );

      if (librarySnap.exists) {
        tx.set(
          libraryRef,
          {
            status: "plan_to_watch",
            watchCounters: buildWatchCounters(
              0,
              totalEpisodesCount,
              airedEpisodesCount,
              0,
            ),
            progressNeedsRecompute: false,
            lastWatchedAt: null,
            updatedAt: now,
            tracking: nextTracking,
            tvProgress: {
              totalEpisodes: totalEpisodesCount,
              watchedEpisodes: 0,
              completionPercent: 0,
              nextToWatch: null,
            },
          },
          { merge: true },
        );
      }
    });

    return res.status(200).json({
      ok: true,
      titleKey,
      deletedCount,
    });
  } catch (err) {
    console.error("unwatchSeries failed:", {
      uid,
      titleKey,
      error: err?.message || err,
    });
    return sendError(
      res,
      500,
      "internal",
      err.message || "Failed to unwatch series.",
    );
  }
}
