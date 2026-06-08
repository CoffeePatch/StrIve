import { db, admin } from "./_lib/firebaseAdmin.js";
import { verifyAuth } from "./_lib/authMiddleware.js";
import { parseTvTitleKey, sendError } from "./_lib/utils.js";
import {
  buildEpisodeStateId,
  commitMergeWritesInChunks,
  loadEpisodesForMutation,
  resolveExpiresAtMs,
  selectEpisodesForMode,
} from "./_lib/watchMutation.js";
import {
  deriveLibraryStatus,
  upsertSeriesProgressAndLibrary,
} from "./_lib/seriesProgress.js";

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

  const mode = payload.mode;
  const seasonNumber = Number(payload.seasonNumber);
  const episodeNumber = Number(payload.episodeNumber);
  const requestId =
    typeof payload.requestId === "string" ? payload.requestId.trim() : "";
  const inputEpisodeCatalog = Array.isArray(payload.episodeCatalog)
    ? payload.episodeCatalog
    : [];

  if (
    !mode ||
    !["single", "backfill_to_episode", "season_all", "all"].includes(mode)
  ) {
    return sendError(
      res,
      400,
      "invalid-argument",
      "mode must be one of: single, backfill_to_episode, season_all, all.",
    );
  }
  if (mode !== "all") {
    if (!Number.isInteger(seasonNumber) || seasonNumber < 1) {
      return sendError(
        res,
        400,
        "invalid-argument",
        "seasonNumber must be a positive integer.",
      );
    }
    if (!Number.isInteger(episodeNumber) || episodeNumber < 1) {
      return sendError(
        res,
        400,
        "invalid-argument",
        "episodeNumber must be a positive integer.",
      );
    }
  }

  const now = admin.firestore.Timestamp.now();
  const nowMs = Date.now();
  const ttlMs = 2 * 60 * 1000;
  const lockDocId = `${titleKey}_watch_lock`;
  const lockRef = db
    .collection("users")
    .doc(uid)
    .collection("watch_mutation_locks")
    .doc(lockDocId);
  const actionId = requestId || db.collection("_").doc().id;
  const actionRef = db
    .collection("users")
    .doc(uid)
    .collection("watch_actions")
    .doc(actionId);

  // Transaction 1: acquire lock + register action intent
  try {
    await db.runTransaction(async (tx) => {
      const [lockSnap, actionSnap] = await Promise.all([
        tx.get(lockRef),
        tx.get(actionRef),
      ]);

      if (actionSnap.exists) {
        const prior = actionSnap.data() || {};
        if (prior.status === "completed") {
          throw new Error(
            "already-exists: This requestId has already been processed.",
          );
        }
      }

      if (lockSnap.exists) {
        const lockData = lockSnap.data() || {};
        const expiresAtMs = resolveExpiresAtMs(lockData.expiresAt);
        if (expiresAtMs > nowMs) {
          throw new Error(
            "aborted: A watch mutation is already in progress for this title.",
          );
        }
      }

      tx.set(
        lockRef,
        {
          titleKey,
          status: "locked",
          requestId: actionId,
          lockedAt: now,
          expiresAt: admin.firestore.Timestamp.fromMillis(nowMs + ttlMs),
        },
        { merge: true },
      );

      tx.set(
        actionRef,
        {
          requestId: actionId,
          uid,
          titleKey,
          mode,
          seasonNumber,
          episodeNumber,
          status: "processing",
          createdAt: now,
          updatedAt: now,
        },
        { merge: true },
      );
    });
  } catch (err) {
    console.error("markEpisodeWatched lock transaction failed:", err);
    return sendError(
      res,
      409,
      "conflict",
      err.message || "Failed to initialize watch mutation.",
    );
  }

  let matchedCount = 0;
  let skippedAlreadyWatched = 0;

  try {
    const titleRef = db.collection("catalog_titles").doc(titleKey);

    const allEpisodes = await loadEpisodesForMutation(
      titleRef,
      inputEpisodeCatalog,
    );
    const { selected } = selectEpisodesForMode(
      allEpisodes,
      mode,
      seasonNumber,
      episodeNumber,
    );

    // Upsert missing catalog episodes when the client provides a catalog payload
    if (inputEpisodeCatalog && inputEpisodeCatalog.length > 0) {
      const episodesSnap = await titleRef.collection("episodes").get();
      const existingKeys = new Set(episodesSnap.docs.map((doc) => doc.id));
      const seedWrites = [];

      if (episodesSnap.empty || allEpisodes.length > existingKeys.size) {
        seedWrites.push({
          ref: titleRef,
          data: {
            titleKey,
            mediaType: "tv",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        });

        for (const ep of allEpisodes) {
          const epId = `${ep.seasonNumber}_${ep.episodeNumber}`;
          if (existingKeys.has(epId)) continue;
          seedWrites.push({
            ref: titleRef.collection("episodes").doc(epId),
            data: ep,
          });
        }

        if (seedWrites.length > 0) {
          await commitMergeWritesInChunks(db, seedWrites, 500);
        }
      }
    }

    // Preload existing states so we can avoid unnecessary writes.
    const stateRefs = selected.map((e) => {
      const stateId = buildEpisodeStateId(
        titleKey,
        e.seasonNumber,
        e.episodeNumber,
      );
      return db
        .collection("users")
        .doc(uid)
        .collection("episode_states")
        .doc(stateId);
    });

    const existingSnaps = await db.getAll(...stateRefs);

    const writes = [];

    for (let i = 0; i < selected.length; i++) {
      const ep = selected[i];
      const existing = existingSnaps[i];
      const existingData = existing.exists ? existing.data() || {} : null;
      if (existingData && existingData.state === "watched") {
        skippedAlreadyWatched++;
        continue;
      }

      writes.push({
        ref: stateRefs[i],
        data: {
          titleKey,
          seasonNumber: ep.seasonNumber,
          episodeNumber: ep.episodeNumber,
          absoluteOrder: ep.absoluteOrder,
          state: "watched",
          watchedAt: now,
          updatedAt: now,
          source: "manual",
        },
      });
    }

    matchedCount = selected.length;

    if (writes.length > 0) {
      await commitMergeWritesInChunks(db, writes, 500);
    }

    const episodeKeyToMeta = new Map();
    let totalEpisodesCount = 0;
    let airedEpisodesCount = 0;

    for (const ep of allEpisodes) {
      const sn = Number(ep.seasonNumber);
      const en = Number(ep.episodeNumber);
      const ao = Number(ep.absoluteOrder);
      const isAired = ep.isAired !== false;

      if (
        !Number.isInteger(sn) ||
        !Number.isInteger(en) ||
        !Number.isFinite(ao)
      ) {
        continue;
      }

      const meta = {
        seasonNumber: sn,
        episodeNumber: en,
        absoluteOrder: ao,
        isAired,
        airDate: ep.airDate || null,
      };

      episodeKeyToMeta.set(`${sn}:${en}`, meta);
      totalEpisodesCount++;
      if (isAired) airedEpisodesCount++;
    }

    const watchedStatesSnap = await db
      .collection("users")
      .doc(uid)
      .collection("episode_states")
      .where("titleKey", "==", titleKey)
      .where("state", "==", "watched")
      .get();

    const watchedSet = new Set();
    let watchedEpisodesCount = 0;
    let watchedAiredCount = 0;
    let lastWatchedEpisode = null;
    let highestAbsolute = -1;

    for (const doc of watchedStatesSnap.docs) {
      const d = doc.data() || {};
      const sn = Number(d.seasonNumber);
      const en = Number(d.episodeNumber);
      const ao = Number(d.absoluteOrder);
      const watchedAt = d.watchedAt || now;

      if (!Number.isInteger(sn) || !Number.isInteger(en) || !Number.isFinite(ao)) {
        continue;
      }

      const key = `${sn}:${en}`;
      if (watchedSet.has(key)) continue;

      watchedSet.add(key);
      watchedEpisodesCount++;

      const meta = episodeKeyToMeta.get(key);
      if (meta?.isAired) watchedAiredCount++;

      if (ao > highestAbsolute) {
        highestAbsolute = ao;
        lastWatchedEpisode = {
          seasonNumber: sn,
          episodeNumber: en,
          absoluteOrder: ao,
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

    const catalogEpisodes = Array.from(episodeKeyToMeta.values()).sort(
      (a, b) => a.absoluteOrder - b.absoluteOrder,
    );

    const nextEpisodeCandidate = catalogEpisodes.find(
      (e) => e.isAired && !watchedSet.has(`${e.seasonNumber}:${e.episodeNumber}`),
    );

    const nextEpisode = nextEpisodeCandidate
      ? {
          seasonNumber: nextEpisodeCandidate.seasonNumber,
          episodeNumber: nextEpisodeCandidate.episodeNumber,
          absoluteOrder: nextEpisodeCandidate.absoluteOrder,
          airDate: nextEpisodeCandidate.airDate || null,
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
      const libraryData = librarySnap.exists ? librarySnap.data() || {} : {};
      const existingStatus =
        typeof libraryData.status === "string" ? libraryData.status : null;
      const status = deriveLibraryStatus(
        existingStatus,
        watchedAiredCount,
        airedEpisodesCount,
      );
      const fallbackLastWatchedAt =
        libraryData?.tracking?.lastWatchedAt || libraryData.lastWatchedAt || null;

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

    // Transaction 2: complete action + release lock
    await db.runTransaction(async (tx) => {
      tx.set(
        actionRef,
        {
          status: "completed",
          matchedCount,
          writtenCount: writes.length,
          skippedAlreadyWatched,
          completedAt: admin.firestore.Timestamp.now(),
          updatedAt: admin.firestore.Timestamp.now(),
        },
        { merge: true },
      );

      tx.set(
        lockRef,
        {
          status: "released",
          releasedAt: admin.firestore.Timestamp.now(),
          expiresAt: admin.firestore.Timestamp.fromMillis(nowMs),
        },
        { merge: true },
      );
    });

    return res.status(200).json({
      ok: true,
      requestId: actionId,
      mode,
      matchedCount,
      writtenCount: writes.length,
      skippedAlreadyWatched,
    });
  } catch (err) {
    console.error("markEpisodeWatched failed:", {
      uid,
      titleKey,
      mode,
      seasonNumber,
      episodeNumber,
      requestId: actionId,
      error: err?.message || err,
    });

    try {
      await db.runTransaction(async (tx) => {
        tx.set(
          actionRef,
          {
            status: "failed",
            matchedCount,
            skippedAlreadyWatched,
            error: String(err?.message || "Unknown error"),
            failedAt: admin.firestore.Timestamp.now(),
            updatedAt: admin.firestore.Timestamp.now(),
          },
          { merge: true },
        );

        tx.set(
          lockRef,
          {
            status: "released",
            releasedAt: admin.firestore.Timestamp.now(),
            expiresAt: admin.firestore.Timestamp.fromMillis(nowMs),
          },
          { merge: true },
        );
      });
    } catch (cleanupErr) {
      console.error("markEpisodeWatched cleanup failed:", cleanupErr);
    }

    return sendError(
      res,
      500,
      "internal",
      err.message || "Failed to mark episodes as watched.",
    );
  }
}
