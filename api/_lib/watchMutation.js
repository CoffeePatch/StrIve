import { db, admin } from "./firebaseAdmin.js";
import { fetchEpisodesFromTmdb } from "./tmdbHelper.js";

export function resolveExpiresAtMs(rawValue) {
  if (!rawValue) return 0;
  if (typeof rawValue === "number")
    return Number.isFinite(rawValue) ? rawValue : 0;
  if (rawValue instanceof Date) return rawValue.getTime();
  if (typeof rawValue === "string") {
    const parsed = Date.parse(rawValue);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  const maybeTimestamp = rawValue;
  if (typeof maybeTimestamp.toMillis === "function") {
    try {
      const v = maybeTimestamp.toMillis();
      return Number.isFinite(v) ? v : 0;
    } catch {
      return 0;
    }
  }

  if (typeof maybeTimestamp._seconds === "number") {
    return (
      maybeTimestamp._seconds * 1000 +
      Math.floor((maybeTimestamp._nanoseconds || 0) / 1_000_000)
    );
  }

  return 0;
}

export async function loadEpisodesForMutation(
  titleRef,
  inputEpisodeCatalog = [],
  expectedEpisodesCount = 0,
  tvId = null,
  targetSeason = null,
  targetEpisodeNum = null,
  mode = null,
) {
  const allEpisodes = [];
  const episodeKeys = new Set();

  const loadFromDb = async () => {
    allEpisodes.length = 0;
    episodeKeys.clear();
    const episodesSnap = await titleRef.collection("episodes").get();
    for (const doc of episodesSnap.docs) {
      const d = doc.data() || {};
      const sn = Number(d.seasonNumber ?? d.season_number);
      const en = Number(d.episodeNumber ?? d.episode_number);
      const ao = Number(d.absoluteOrder);
      const isAired = d.isAired !== false;

      if (
        !Number.isInteger(sn) ||
        !Number.isInteger(en) ||
        !Number.isFinite(ao)
      ) {
        continue;
      }

      allEpisodes.push({
        seasonNumber: sn,
        episodeNumber: en,
        absoluteOrder: ao,
        isAired,
      });
      episodeKeys.add(`${sn}:${en}`);
    }
    return episodesSnap.size;
  };

  // 1. Load what we currently have in DB
  let dbCount = await loadFromDb();

  // 2. Check if we have a target episode and if it's missing from DB
  const hasTarget = mode !== "all" && Number.isInteger(targetSeason) && Number.isInteger(targetEpisodeNum);
  const targetKey = hasTarget ? `${targetSeason}:${targetEpisodeNum}` : null;
  const isTargetMissing = targetKey && !episodeKeys.has(targetKey);

  // 3. Determine if the catalog is incomplete
  const isIncomplete = dbCount === 0 || isTargetMissing || (expectedEpisodesCount > 0 && dbCount < expectedEpisodesCount);

  if (isIncomplete && tvId) {
    try {
      console.log(`loadEpisodesForMutation: Catalog incomplete (dbCount=${dbCount}, isTargetMissing=${isTargetMissing}, expected=${expectedEpisodesCount}). Fetching TMDB for TV ${tvId}...`);
      const tmdbEpisodes = await fetchEpisodesFromTmdb(tvId);

      if (tmdbEpisodes && tmdbEpisodes.length > 0) {
        // Find missing episodes by comparing keys
        const seedWrites = [{
          ref: titleRef,
          data: {
            titleKey: `tmdb_tv_${tvId}`,
            mediaType: "tv",
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          },
        }];

        let newEpisodesAdded = 0;
        for (const ep of tmdbEpisodes) {
          const epKey = `${ep.seasonNumber}:${ep.episodeNumber}`;
          if (!episodeKeys.has(epKey)) {
            const epId = `${ep.seasonNumber}_${ep.episodeNumber}`;
            seedWrites.push({
              ref: titleRef.collection("episodes").doc(epId),
              data: ep,
            });
            newEpisodesAdded++;
          }
        }

        if (newEpisodesAdded > 0) {
          console.log(`loadEpisodesForMutation: Seeding ${newEpisodesAdded} missing episodes to DB for TV ${tvId}...`);
          await commitMergeWritesInChunks(db, seedWrites, 500);
          // Reload from DB to get the complete list
          await loadFromDb();
        }
      }
    } catch (tmdbErr) {
      console.warn("Failed to self-heal episodes from TMDB during mutation:", tmdbErr);
    }
  }

  // Fallback: If still empty, use inputEpisodeCatalog as a last resort
  if (allEpisodes.length === 0 && inputEpisodeCatalog && inputEpisodeCatalog.length > 0) {
    console.log("loadEpisodesForMutation: DB catalog empty and TMDB fetch failed. Using client payload fallback.");
    for (let i = 0; i < inputEpisodeCatalog.length; i++) {
      const ep = inputEpisodeCatalog[i] || {};
      const sn = Number(ep.seasonNumber);
      const en = Number(ep.episodeNumber);
      const ao = Number(ep.absoluteOrder ?? (Number.isInteger(sn * 1000 + en) ? sn * 1000 + en : i + 1));
      const isAired = ep.isAired !== false;

      if (
        !Number.isInteger(sn) ||
        !Number.isInteger(en) ||
        !Number.isFinite(ao)
      ) {
        continue;
      }

      const key = `${sn}:${en}`;
      if (episodeKeys.has(key)) {
        continue;
      }

      allEpisodes.push({
        seasonNumber: sn,
        episodeNumber: en,
        absoluteOrder: ao,
        isAired,
      });
      episodeKeys.add(key);
    }
  }

  if (allEpisodes.length === 0) {
    throw new Error(
      "failed-precondition: Episode metadata is unavailable. Seed catalog_titles episodes or pass episodeCatalog from client.",
    );
  }

  return allEpisodes;
}

export function selectEpisodesForMode(
  allEpisodes,
  mode,
  seasonNumber,
  episodeNumber,
) {
  if (mode === "all") {
    const selected = allEpisodes
      .filter((e) => e.isAired)
      .sort((a, b) => a.absoluteOrder - b.absoluteOrder);
      
    if (selected.length === 0) {
      throw new Error("failed-precondition: No eligible aired episodes matched this request.");
    }
    return { target: null, selected };
  }

  const target = allEpisodes.find(
    (e) => e.seasonNumber === seasonNumber && e.episodeNumber === episodeNumber,
  );
  if (!target) {
    throw new Error(
      `not-found: Target episode S${seasonNumber}E${episodeNumber} not found.`,
    );
  }

  let selected = [];

  if (mode === "single") {
    if (!target.isAired) {
      throw new Error("failed-precondition: Target episode has not aired yet.");
    }
    selected = [target];
  } else if (mode === "backfill_to_episode") {
    selected = allEpisodes
      .filter((e) => e.isAired && e.absoluteOrder <= target.absoluteOrder)
      .sort((a, b) => a.absoluteOrder - b.absoluteOrder);
  } else {
    selected = allEpisodes
      .filter((e) => e.isAired && e.seasonNumber === seasonNumber)
      .sort((a, b) => a.episodeNumber - b.episodeNumber);
  }

  if (selected.length === 0) {
    throw new Error(
      "failed-precondition: No eligible aired episodes matched this request.",
    );
  }

  return { target, selected };
}

export function buildEpisodeStateId(titleKey, seasonNumber, episodeNumber) {
  const s = String(seasonNumber).padStart(2, "0");
  const ep = String(episodeNumber).padStart(2, "0");
  return `${titleKey}_s${s}e${ep}`;
}

export async function commitMergeWritesInChunks(db, writes, maxBatchOps = 500) {
  for (let i = 0; i < writes.length; i += maxBatchOps) {
    const chunk = writes.slice(i, i + maxBatchOps);
    const batch = db.batch();
    for (const w of chunk) {
      batch.set(w.ref, w.data, { merge: true });
    }
    await batch.commit();
  }
}
