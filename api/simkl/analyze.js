import prisma from "../_lib/prisma.js";
import { verifyAuth } from "../_lib/authMiddleware.js";
import { handleApiError } from "../_lib/errorHandler.js";
import { decryptToken } from "../_lib/security/tokenCipher.js";
import { sendError } from "../_lib/utils.js";

export default async function handler(req, res) {
  if (req.method !== "POST" && req.method !== "GET") {
    return sendError(res, 405, "method-not-allowed", "Only GET and POST are allowed");
  }

  try {
    const decodedToken = await verifyAuth(req);
    const userId = decodedToken.uid;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { simklToken: true },
    });

    if (!user || !user.simklToken) {
      return sendError(res, 401, "simkl-not-connected", "Simkl account is not connected. Please connect your Simkl account in Settings.");
    }

    const accessToken = decryptToken(user.simklToken);
    if (!accessToken) {
      return sendError(res, 401, "token-invalid", "Stored Simkl authentication token is invalid or corrupted. Please reconnect Simkl.");
    }

    const clientId = process.env.SIMKL_CLIENT_ID || process.env.VITE_SIMKL_CLIENT_ID;
    if (!clientId) {
      return sendError(res, 500, "configuration-error", "SIMKL_CLIENT_ID is missing");
    }

    const type = req.body?.type || req.query?.type || "movies";
    const validTypes = ["movies", "shows"];
    const targetType = validTypes.includes(type) ? type : "movies";

    // Perform strictly ONE outbound Simkl API call
    const simklRes = await fetch(`https://api.simkl.com/sync/all-items/${targetType}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "simkl-api-key": clientId,
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (!simklRes.ok) {
      if (simklRes.status === 429) {
        const retryAfter = simklRes.headers.get("retry-after") || "60";
        return sendError(res, 429, "rate-limited", `Simkl API rate limit reached. Please wait ${retryAfter} seconds.`, { retryAfter });
      }
      if (simklRes.status === 401 || simklRes.status === 403) {
        return sendError(res, 401, "auth-failed", "Simkl authorization expired or revoked. Please reconnect your account.");
      }
      const errData = await simklRes.json().catch(() => ({}));
      return sendError(res, simklRes.status || 500, "simkl-error", errData.message || "Failed to fetch data from Simkl");
    }

    const simklData = await simklRes.json();
    const simklList = Array.isArray(simklData[targetType]) ? simklData[targetType] : (Array.isArray(simklData) ? simklData : []);

    // Read-only PostgreSQL queries
    const striveLibraryItems = await prisma.userLibraryItem.findMany({
      where: { userId },
      include: { catalogTitle: true },
    });

    const striveEpisodeStates = targetType === "shows" ? await prisma.userEpisodeState.findMany({
      where: { userId, state: "watched" },
    }) : [];

    const striveEpisodeMap = new Set(
      striveEpisodeStates.map(ep => `${ep.titleKey}_S${ep.seasonNumber}E${ep.episodeNumber}`)
    );

    // Map Strive library by tmdbId and imdbId for fast O(1) matching
    const striveByTmdb = new Map();
    const striveByImdb = new Map();

    for (const item of striveLibraryItems) {
      const c = item.catalogTitle || {};
      if (c.tmdbId) striveByTmdb.set(Number(c.tmdbId), item);
      if (c.imdbId) striveByImdb.set(String(c.imdbId), item);
    }

    const diffs = [];
    let matchedCount = 0;
    let simklOnlyCount = 0;
    let watchDiffCount = 0;
    let ratingDiffCount = 0;
    let unmatchedCount = 0;

    for (const simklItem of simklList) {
      const ids = simklItem.ids || {};
      const tmdbId = ids.tmdb ? Number(ids.tmdb) : null;
      const imdbId = ids.imdb ? String(ids.imdb) : null;
      const title = simklItem.title || simklItem.name || "Unknown Title";

      if (!tmdbId && !imdbId) {
        unmatchedCount++;
        diffs.push({
          title,
          type: targetType,
          changeType: "UNMATCHED",
          reason: "Missing TMDb and IMDb identifiers",
        });
        continue;
      }

      const striveMatch = (tmdbId && striveByTmdb.get(tmdbId)) || (imdbId && striveByImdb.get(imdbId));

      const simklRating = simklItem.user_rating ? Math.min(10, Math.max(1, Math.round(Number(simklItem.user_rating)))) : null;
      const simklWatched = Boolean(simklItem.watched_at || (Array.isArray(simklItem.episodes) && simklItem.episodes.length > 0));

      if (!striveMatch) {
        simklOnlyCount++;
        diffs.push({
          title,
          type: targetType,
          tmdbId,
          imdbId,
          changeType: "SIMKL_ONLY",
          proposedStatus: simklWatched ? "completed" : "plan_to_watch",
          proposedRating: simklRating,
        });
        continue;
      }

      // Found match in Strive PostgreSQL
      const striveRating = striveMatch.userRating ? Math.round(Number(striveMatch.userRating)) : null;
      const striveWatched = striveMatch.status === "completed" || striveMatch.status === "watching";
      let episodeDiffs = 0;
      if (targetType === "shows" && Array.isArray(simklItem.episodes)) {
        for (const ep of simklItem.episodes) {
          const epKey = `${striveMatch.titleKey}_S${ep.season}E${ep.number}`;
          if (!striveEpisodeMap.has(epKey)) {
            episodeDiffs++;
          }
        }
      }

      let hasWatchDiff = striveWatched !== simklWatched || episodeDiffs > 0;
      let hasRatingDiff = simklRating !== null && simklRating !== striveRating;

      if (hasWatchDiff || hasRatingDiff) {
        if (hasWatchDiff) watchDiffCount++;
        if (hasRatingDiff) ratingDiffCount++;

        const changeType = hasWatchDiff && hasRatingDiff 
          ? "WATCH_AND_RATING_DIFFERENCE" 
          : (hasWatchDiff ? "WATCH_STATUS_DIFFERENCE" : "RATING_DIFFERENCE");

        diffs.push({
          titleKey: striveMatch.titleKey,
          title,
          type: targetType,
          tmdbId,
          imdbId,
          striveStatus: striveMatch.status,
          simklStatus: simklWatched ? "completed" : "watching",
          striveRating,
          simklRating,
          changeType,
        });
      } else {
        matchedCount++;
      }
    }

    return res.status(200).json({
      success: true,
      mediaType: targetType,
      summary: {
        simklItems: simklList.length,
        matched: matchedCount,
        simklOnly: simklOnlyCount,
        watchDifferences: watchDiffCount,
        ratingDifferences: ratingDiffCount,
        unmatched: unmatchedCount,
      },
      diffs,
    });
  } catch (err) {
    return handleApiError(res, err);
  }
}
