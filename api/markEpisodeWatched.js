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
    !["single", "backfill_to_episode", "season_all"].includes(mode)
  ) {
    return sendError(
      res,
      400,
      "invalid-argument",
      "mode must be one of: single, backfill_to_episode, season_all.",
    );
  }
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

    // Auto-seed the catalog if it was empty, using the fallback payload
    if (inputEpisodeCatalog && inputEpisodeCatalog.length > 0) {
      const episodesSnap = await titleRef.collection("episodes").limit(1).get();
      if (episodesSnap.empty) {
        const seedWrites = [];
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
          seedWrites.push({
            ref: titleRef.collection("episodes").doc(epId),
            data: ep,
          });
        }
        await commitMergeWritesInChunks(db, seedWrites, 500);
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

    // Mark title-level progress as stale; dedicated recompute logic can process it later.
    await db
      .collection("users")
      .doc(uid)
      .collection("library_items")
      .doc(titleKey)
      .set(
        {
          updatedAt: now,
          progressNeedsRecompute: true,
        },
        { merge: true },
      );

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
