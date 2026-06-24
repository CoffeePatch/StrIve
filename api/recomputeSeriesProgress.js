import { db, admin } from "./_lib/firebaseAdmin.js";
import { verifyAuth } from "./_lib/authMiddleware.js";
import { parseTvTitleKey, sendError } from "./_lib/utils.js";
import {
  deriveLibraryStatus,
  parseCatalogEpisodes,
  upsertSeriesProgressAndLibrary,
} from "./_lib/seriesProgress.js";
import { fetchEpisodesFromTmdb } from "./_lib/tmdbHelper.js";
import { commitMergeWritesInChunks } from "./_lib/watchMutation.js";

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
  const titleRef = db.collection("catalog_titles").doc(titleKey);

  try {
    const titleSnap = await titleRef.get();
    if (!titleSnap.exists) {
      console.log(`recomputeSeriesProgress: Title ${titleKey} not found in catalog. Seeding title document...`);
      await titleRef.set({
        titleKey,
        mediaType: "tv",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } else {
      const titleData = titleSnap.data() || {};
      if (titleData.mediaType !== "tv") {
        return sendError(
          res,
          400,
          "failed-precondition",
          "recomputeSeriesProgress only supports TV titles.",
        );
      }
    }

    const tvId = titleKey.substring("tmdb_tv_".length);
    let episodesSnap = await titleRef.collection("episodes").get();

    // Fetch TMDB episodes to ensure correctness
    let tmdbEpisodes = [];
    try {
      tmdbEpisodes = await fetchEpisodesFromTmdb(tvId);
    } catch (tmdbErr) {
      console.warn("Failed to fetch TMDB details during recompute:", tmdbErr);
    }

    if (tmdbEpisodes.length > 0 && (episodesSnap.empty || episodesSnap.size < tmdbEpisodes.length)) {
      console.log(`recomputeSeriesProgress: Seeding/healing catalog for TV ${tvId} (DB size=${episodesSnap.size}, TMDB size=${tmdbEpisodes.length})`);
      const existingKeys = new Set(episodesSnap.docs.map((doc) => doc.id));
      const seedWrites = [];

      for (const ep of tmdbEpisodes) {
        const epId = `${ep.seasonNumber}_${ep.episodeNumber}`;
        if (!existingKeys.has(epId)) {
          seedWrites.push({
            ref: titleRef.collection("episodes").doc(epId),
            data: ep,
          });
        }
      }

      if (seedWrites.length > 0) {
        console.log(`recomputeSeriesProgress: Seeding ${seedWrites.length} missing episodes to DB for TV ${tvId}...`);
        await commitMergeWritesInChunks(db, seedWrites, 500);
        // Reload episodesSnap
        episodesSnap = await titleRef.collection("episodes").get();
      }
    }

    if (episodesSnap.empty) {
      return sendError(
        res,
        404,
        "not-found",
        "No catalog episodes found for this title and TMDB fetch failed.",
      );
    }

    const watchedStatesSnap = await db
      .collection("users")
      .doc(uid)
      .collection("episode_states")
      .where("titleKey", "==", titleKey)
      .where("state", "==", "watched")
      .get();

    const {
      episodes: catalogEpisodes,
      episodeKeyToMeta,
      totalEpisodesCount,
      airedEpisodesCount,
    } = parseCatalogEpisodes(episodesSnap);

    if (catalogEpisodes.length === 0) {
      return sendError(
        res,
        400,
        "failed-precondition",
        "Catalog episodes are invalid for this title.",
      );
    }

    const watchedSet = new Set();
    let watchedEpisodesCount = 0;
    let watchedAiredCount = 0;
    let lastWatchedEpisode = null;
    let highestAbsolute = -1;

    for (const doc of watchedStatesSnap.docs) {
      const d = doc.data() || {};
      const seasonNumber = Number(d.seasonNumber);
      const episodeNumber = Number(d.episodeNumber);
      const absoluteOrder = Number(d.absoluteOrder);
      const watchedAt = d.watchedAt || now;

      if (
        !Number.isInteger(seasonNumber) ||
        !Number.isInteger(episodeNumber) ||
        !Number.isFinite(absoluteOrder)
      ) {
        continue;
      }

      const key = `${seasonNumber}:${episodeNumber}`;
      if (watchedSet.has(key)) {
        continue;
      }

      watchedSet.add(key);
      watchedEpisodesCount++;

      const meta = episodeKeyToMeta.get(key);
      if (meta?.isAired) {
        watchedAiredCount++;
      }

      if (absoluteOrder > highestAbsolute) {
        highestAbsolute = absoluteOrder;
        lastWatchedEpisode = {
          seasonNumber,
          episodeNumber,
          absoluteOrder,
          watchedAt,
        };
      }
    }

    const completionRatioAired =
      airedEpisodesCount > 0
        ? Math.min(1, watchedAiredCount / airedEpisodesCount)
        : 0;
    const completionRatioTotal =
      totalEpisodesCount > 0
        ? Math.min(1, watchedEpisodesCount / totalEpisodesCount)
        : 0;

    const nextEpisodeCandidate = catalogEpisodes
      .filter(
        (e) =>
          e.isAired && !watchedSet.has(`${e.seasonNumber}:${e.episodeNumber}`),
      )
      .sort((a, b) => a.absoluteOrder - b.absoluteOrder)[0];

    const nextEpisode = nextEpisodeCandidate
      ? {
          seasonNumber: nextEpisodeCandidate.seasonNumber,
          episodeNumber: nextEpisodeCandidate.episodeNumber,
          absoluteOrder: nextEpisodeCandidate.absoluteOrder,
          airDate: nextEpisodeCandidate.airDate,
        }
      : null;

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
      const librarySnap = await tx.get(libraryRef);
      const libraryData = librarySnap.exists ? librarySnap.data() : {};
      const existingStatus =
        typeof libraryData.status === "string" ? libraryData.status : null;
      const status = deriveLibraryStatus(
        existingStatus,
        watchedAiredCount,
        airedEpisodesCount,
      );
      const fallbackLastWatchedAt =
        libraryData?.tracking?.lastWatchedAt ||
        libraryData.lastWatchedAt ||
        null;

      upsertSeriesProgressAndLibrary(tx, {
        progressRef,
        libraryRef,
        titleKey,
        status,
        watchedEpisodesCount,
        airedEpisodesCount,
        totalEpisodesCount,
        completionRatioAired,
        completionRatioTotal,
        lastWatchedEpisode,
        nextEpisode,
        progressNeedsRecompute: false,
        lastWatchedAt: lastWatchedEpisode?.watchedAt || fallbackLastWatchedAt,
        updatedAt: now,
        tracking: libraryData.tracking || null,
      });
    });

    return res.status(200).json({
      ok: true,
      titleKey,
      watchedEpisodesCount,
      watchedAiredCount,
      airedEpisodesCount,
      totalEpisodesCount,
      completionRatioAired,
      completionRatioTotal,
    });
  } catch (err) {
    console.error("recomputeSeriesProgress failed:", err);
    return sendError(
      res,
      500,
      "internal",
      err.message || "Failed to recompute series progress.",
    );
  }
}
