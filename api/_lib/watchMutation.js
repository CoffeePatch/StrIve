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
) {
  const allEpisodes = [];

  // Primary source: global catalog
  try {
    const titleSnap = await titleRef.get();
    const titleData = titleSnap.exists ? titleSnap.data() || {} : null;

    if (titleData && titleData.mediaType === "tv") {
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
      }
    }
  } catch (catalogErr) {
    console.warn(
      "markEpisodeWatched catalog read failed; trying payload fallback:",
      catalogErr,
    );
  }

  // Fallback source: client-provided episode catalog
  if (allEpisodes.length === 0 && inputEpisodeCatalog.length > 0) {
    for (let i = 0; i < inputEpisodeCatalog.length; i++) {
      const ep = inputEpisodeCatalog[i] || {};
      const sn = Number(ep.seasonNumber);
      const en = Number(ep.episodeNumber);
      const ao = Number(ep.absoluteOrder ?? sn * 1000 + en ?? i + 1);
      const isAired = ep.isAired !== false;

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
