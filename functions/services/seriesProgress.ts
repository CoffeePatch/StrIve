import * as admin from 'firebase-admin';

export type LibraryStatus = 'plan_to_watch' | 'watching' | 'completed' | 'dropped' | null;

export interface CatalogEpisode {
  seasonNumber: number;
  episodeNumber: number;
  absoluteOrder: number;
  isAired: boolean;
  airDate: admin.firestore.Timestamp | null;
}

export interface ParsedCatalogEpisodes {
  episodes: CatalogEpisode[];
  episodeKeyToMeta: Map<string, CatalogEpisode>;
  totalEpisodesCount: number;
  airedEpisodesCount: number;
}

export function parseCatalogEpisodes(
  episodesSnap: FirebaseFirestore.QuerySnapshot
): ParsedCatalogEpisodes {
  const episodes: CatalogEpisode[] = [];
  const episodeKeyToMeta = new Map<string, CatalogEpisode>();

  let totalEpisodesCount = 0;
  let airedEpisodesCount = 0;

  for (const doc of episodesSnap.docs) {
    const d = doc.data() || {};
    const seasonNumber = Number(d.seasonNumber);
    const episodeNumber = Number(d.episodeNumber);
    const absoluteOrder = Number(d.absoluteOrder);
    const isAired = !!d.isAired;
    const airDate = (d.airDate as admin.firestore.Timestamp | undefined) || null;

    if (!Number.isInteger(seasonNumber) || !Number.isInteger(episodeNumber) || !Number.isFinite(absoluteOrder)) {
      continue;
    }

    const ep: CatalogEpisode = {
      seasonNumber,
      episodeNumber,
      absoluteOrder,
      isAired,
      airDate,
    };

    const key = `${seasonNumber}:${episodeNumber}`;
    episodeKeyToMeta.set(key, ep);
    episodes.push(ep);
    totalEpisodesCount++;
    if (isAired) airedEpisodesCount++;
  }

  return {
    episodes,
    episodeKeyToMeta,
    totalEpisodesCount,
    airedEpisodesCount,
  };
}

export function deriveLibraryStatus(
  existingStatus: string | null,
  watchedEpisodesCount: number,
  airedEpisodesCount: number
): LibraryStatus {
  if (watchedEpisodesCount <= 0) {
    return existingStatus === 'plan_to_watch' || existingStatus === 'dropped' ? existingStatus : null;
  }
  if (airedEpisodesCount > 0 && watchedEpisodesCount >= airedEpisodesCount) {
    return 'completed';
  }
  return 'watching';
}

export function buildWatchCounters(
  watchedEpisodesCount: number,
  totalEpisodesCount: number,
  airedEpisodesCount: number,
  completionRatioAired: number
): {
  watchedEpisodesCount: number;
  totalEpisodesCount: number;
  airedEpisodesCount: number;
  unAiredEpisodesCount: number;
  completionRatio: number;
} {
  return {
    watchedEpisodesCount,
    totalEpisodesCount,
    airedEpisodesCount,
    unAiredEpisodesCount: Math.max(0, totalEpisodesCount - airedEpisodesCount),
    completionRatio: completionRatioAired,
  };
}

export function upsertSeriesProgressAndLibrary(
  tx: FirebaseFirestore.Transaction,
  args: {
    progressRef: FirebaseFirestore.DocumentReference;
    libraryRef: FirebaseFirestore.DocumentReference;
    titleKey: string;
    status: LibraryStatus;
    watchedEpisodesCount: number;
    airedEpisodesCount: number;
    totalEpisodesCount: number;
    completionRatioAired: number;
    completionRatioTotal: number;
    lastWatchedEpisode: Record<string, any> | null;
    nextEpisode: Record<string, any> | null;
    progressNeedsRecompute: boolean;
    lastWatchedAt: admin.firestore.Timestamp | null;
    updatedAt: admin.firestore.Timestamp;
  }
): void {
  tx.set(args.progressRef, {
    titleKey: args.titleKey,
    watchedEpisodesCount: args.watchedEpisodesCount,
    airedEpisodesCount: args.airedEpisodesCount,
    totalEpisodesCount: args.totalEpisodesCount,
    completionRatioAired: args.completionRatioAired,
    completionRatioTotal: args.completionRatioTotal,
    lastWatchedEpisode: args.lastWatchedEpisode,
    nextEpisode: args.nextEpisode,
    progressNeedsRecompute: args.progressNeedsRecompute,
    updatedAt: args.updatedAt,
  }, { merge: true });

  tx.set(args.libraryRef, {
    titleKey: args.titleKey,
    mediaType: 'tv',
    status: args.status,
    watchCounters: buildWatchCounters(
      args.watchedEpisodesCount,
      args.totalEpisodesCount,
      args.airedEpisodesCount,
      args.completionRatioAired
    ),
    progressNeedsRecompute: args.progressNeedsRecompute,
    lastWatchedAt: args.lastWatchedAt,
    updatedAt: args.updatedAt,
  }, { merge: true });
}
