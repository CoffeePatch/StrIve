import dotenv from "dotenv";
import admin from "firebase-admin";
import axios from "axios";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const TMDB_API_KEY = process.env.TMDB_API_KEY || "1298606291045f5d78fcc3ea0fd45d9e";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

const db = admin.firestore();

// Helper to wait
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Helper for fetching with retries
async function axiosGetWithRetry(url, retries = 3, delayMs = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(url);
      return res.data;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.warn(`    Fetch failed: ${err.message}. Retrying in ${delayMs}ms... (attempt ${i + 1}/${retries})`);
      await wait(delayMs);
    }
  }
}

// Helper for chunked batch writes
async function commitMergeWritesInChunks(writes, maxBatchOps = 500) {
  for (let i = 0; i < writes.length; i += maxBatchOps) {
    const chunk = writes.slice(i, i + maxBatchOps);
    const batch = db.batch();
    for (const w of chunk) {
      batch.set(w.ref, w.data, { merge: true });
    }
    await batch.commit();
  }
}

// Fetch episodes from TMDB
async function fetchEpisodesFromTmdb(tvId) {
  const detailsUrl = `https://api.themoviedb.org/3/tv/${tvId}?api_key=${TMDB_API_KEY}`;
  const details = await axiosGetWithRetry(detailsUrl);
  const numberOfSeasons = details.number_of_seasons;

  if (!numberOfSeasons || numberOfSeasons < 1) {
    return [];
  }

  const allEpisodes = [];
  for (let s = 1; s <= numberOfSeasons; s++) {
    try {
      await wait(300); // Rate limit safety between seasons
      const seasonUrl = `https://api.themoviedb.org/3/tv/${tvId}/season/${s}?api_key=${TMDB_API_KEY}`;
      const seasonData = await axiosGetWithRetry(seasonUrl);

      if (seasonData && Array.isArray(seasonData.episodes)) {
        for (const ep of seasonData.episodes) {
          const sn = seasonData.season_number;
          const en = ep.episode_number;
          const ao = ep.absolute_order || (sn * 1000 + en);
          const airDate = ep.air_date || null;
          const isAired = airDate ? new Date(airDate) <= new Date() : true;

          allEpisodes.push({
            seasonNumber: sn,
            episodeNumber: en,
            absoluteOrder: ao,
            isAired,
            airDate,
          });
        }
      }
    } catch (err) {
      console.warn(`Failed to fetch Season ${s} for TV ${tvId}:`, err.message);
    }
  }

  return allEpisodes;
}

// Derive library status
function deriveLibraryStatus(existingStatus, watchedEpisodesCount, airedEpisodesCount) {
  if (watchedEpisodesCount <= 0) {
    return existingStatus === "plan_to_watch" || existingStatus === "dropped"
      ? existingStatus
      : null;
  }
  if (airedEpisodesCount > 0 && watchedEpisodesCount >= airedEpisodesCount) {
    return "completed";
  }
  return "watching";
}

async function run() {
  console.log("Scanning series_progress for catalog corruption...");

  const progressSnap = await db.collectionGroup("series_progress").get();
  console.log(`Found ${progressSnap.size} series_progress records.`);

  for (const doc of progressSnap.docs) {
    const data = doc.data();
    const titleKey = doc.id;
    const pathSegments = doc.ref.path.split("/");
    const uid = pathSegments[1];

    if (!titleKey.startsWith("tmdb_tv_")) continue;
    const tvId = titleKey.replace("tmdb_tv_", "");

    console.log(`\nChecking TV Show: ${titleKey} for User: ${uid}`);
    await wait(500); // 500ms delay between TV shows to prevent connection resets
    
    // Fetch show details from TMDB
    let tmdbDetails;
    try {
      const url = `https://api.themoviedb.org/3/tv/${tvId}?api_key=${TMDB_API_KEY}`;
      tmdbDetails = await axiosGetWithRetry(url);
    } catch (err) {
      console.error(`  Failed to fetch details from TMDB for TV ${tvId}:`, err.message);
      continue;
    }

    const actualTotalEpisodes = tmdbDetails.number_of_episodes;
    const storedTotalEpisodes = data.totalEpisodesCount || 0;

    console.log(`  Stored episodes count: ${storedTotalEpisodes} | Actual TMDB count: ${actualTotalEpisodes}`);

    const isStatusInconsistent = (data.watchedEpisodesCount > 0 && 
                                   data.watchedEpisodesCount < data.totalEpisodesCount && 
                                   (data.tracking?.watchStatus === "plan_to_watch" || !data.tracking?.watchStatus));

    // If stored count is less than actual count, or status is inconsistent, or it is Outer Banks, repair it!
    if (storedTotalEpisodes < actualTotalEpisodes || isStatusInconsistent || titleKey === "tmdb_tv_100757") {
      console.log(`  [CORRUPTION DETECTED] Repairing ${titleKey} (${tmdbDetails.name})...`);

      // 1. Fetch complete episodes from TMDB
      console.log("  Fetching full episode catalog from TMDB...");
      const tmdbEpisodes = await fetchEpisodesFromTmdb(tvId);
      if (tmdbEpisodes.length === 0) {
        console.warn("  Failed to retrieve episodes from TMDB. Skipping repair.");
        continue;
      }

      // 2. Seed catalog in Firestore
      const titleRef = db.collection("catalog_titles").doc(titleKey);
      const episodesSnap = await titleRef.collection("episodes").get();
      const existingKeys = new Set(episodesSnap.docs.map((d) => d.id));

      const seedWrites = [{
        ref: titleRef,
        data: {
          titleKey,
          mediaType: "tv",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      }];

      let seedCount = 0;
      for (const ep of tmdbEpisodes) {
        const epId = `${ep.seasonNumber}_${ep.episodeNumber}`;
        if (!existingKeys.has(epId)) {
          seedWrites.push({
            ref: titleRef.collection("episodes").doc(epId),
            data: ep,
          });
          seedCount++;
        }
      }

      if (seedWrites.length > 0) {
        console.log(`  Seeding ${seedCount} missing episodes to catalog_titles/${titleKey}/episodes...`);
        await commitMergeWritesInChunks(seedWrites, 500);
      }

      // 3. Load all watched states for user
      console.log("  Loading user watched states...");
      const watchedStatesSnap = await db
        .collection("users")
        .doc(uid)
        .collection("episode_states")
        .where("titleKey", "==", titleKey)
        .where("state", "==", "watched")
        .get();

      // 4. Calculate progress based on full catalog and watched states
      const episodeKeyToMeta = new Map();
      let totalEpisodesCount = 0;
      let airedEpisodesCount = 0;

      for (const ep of tmdbEpisodes) {
        const key = `${ep.seasonNumber}:${ep.episodeNumber}`;
        episodeKeyToMeta.set(key, ep);
        totalEpisodesCount++;
        if (ep.isAired) airedEpisodesCount++;
      }

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
        const watchedAt = d.watchedAt || admin.firestore.Timestamp.now();

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

      // Find next episode
      const sortedCatalog = [...tmdbEpisodes].sort((a, b) => a.absoluteOrder - b.absoluteOrder);
      const nextEpisodeCandidate = sortedCatalog.find(
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

      // 5. Update Firestore records in a transaction
      console.log("  Writing repaired progress and library items to Firestore...");
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
        const existingStatus = typeof libraryData.status === "string" ? libraryData.status : null;
        
        const status = deriveLibraryStatus(
          existingStatus,
          watchedAiredCount,
          airedEpisodesCount,
        );

        const fallbackLastWatchedAt = libraryData?.tracking?.lastWatchedAt || libraryData.lastWatchedAt || null;
        const lastWatchedAt = lastWatchedEpisode?.watchedAt || fallbackLastWatchedAt;
        const now = admin.firestore.Timestamp.now();

        const completionPercent = totalEpisodesCount > 0
          ? Math.round((watchedEpisodesCount / totalEpisodesCount) * 10000) / 100
          : 0;

        const nextToWatch = nextEpisode && Number.isInteger(nextEpisode.seasonNumber) && Number.isInteger(nextEpisode.episodeNumber)
          ? {
              seasonNumber: Number(nextEpisode.seasonNumber),
              episodeNumber: Number(nextEpisode.episodeNumber),
            }
          : null;

        const nextTracking = {
          ...(libraryData.tracking || {}),
          watchStatus: status,
          updatedAt: now,
          lastWatchedAt: lastWatchedAt,
        };


        // Update progress
        tx.set(
          progressRef,
          {
            titleKey,
            watchedEpisodesCount,
            airedEpisodesCount,
            totalEpisodesCount,
            completionRatioAired,
            completionRatioTotal,
            lastWatchedEpisode,
            nextEpisode,
            progressNeedsRecompute: false,
            updatedAt: now,
          },
          { merge: true },
        );

        // Update library item
        tx.set(
          libraryRef,
          {
            titleKey,
            mediaType: "tv",
            status,
            watchCounters: {
              watchedEpisodesCount,
              totalEpisodesCount,
              airedEpisodesCount,
              unAiredEpisodesCount: Math.max(0, totalEpisodesCount - airedEpisodesCount),
              completionRatio: completionRatioAired,
            },
            progressNeedsRecompute: false,
            lastWatchedAt,
            updatedAt: now,
            tracking: nextTracking,
            tvProgress: {
              totalEpisodes: totalEpisodesCount,
              watchedEpisodes: watchedEpisodesCount,
              completionPercent,
              nextToWatch,
            },
          },
          { merge: true },
        );
      });

      console.log(`  [REPAIRED] Completed repair for ${titleKey}. New progress: ${watchedEpisodesCount}/${totalEpisodesCount} episodes watched.`);
    } else {
      console.log("  [OK] Progress record is correct.");
    }
  }

  console.log("\nScan and repair completed successfully.");
}

run().catch(console.error);
