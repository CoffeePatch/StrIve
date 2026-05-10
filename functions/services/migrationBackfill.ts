import * as admin from 'firebase-admin';

export type SourceKind = 'watchlist' | 'watched' | 'custom';

export type EpisodeCandidate = {
  titleKey: string;
  seasonNumber: number;
  episodeNumber: number;
  watchedAt: admin.firestore.Timestamp;
  source: string;
};

export type LibraryAggregate = {
  titleKey: string;
  mediaType: 'movie' | 'tv';
  status: 'plan_to_watch' | 'watching' | 'completed' | 'dropped' | null;
  listIds: Set<string>;
  userRating: number | null;
  addedAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
  lastWatchedAt: admin.firestore.Timestamp | null;
  sort: {
    imdbRating: number | null;
    tmdbRating: number | null;
    popularity: number | null;
    year: number | null;
    titleLower: string;
  };
};

export type PendingWrite = {
  ref: FirebaseFirestore.DocumentReference;
  data: FirebaseFirestore.DocumentData;
  merge?: boolean;
};

export type MigrationFailure = {
  stage: string;
  id?: string;
  error: string;
};

export function toTimestamp(v: unknown): admin.firestore.Timestamp {
  if (!v) return admin.firestore.Timestamp.now();
  if (v instanceof admin.firestore.Timestamp) return v;
  if (v instanceof Date) return admin.firestore.Timestamp.fromDate(v);
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return admin.firestore.Timestamp.fromDate(d);
  }
  return admin.firestore.Timestamp.now();
}

export function detectMediaType(item: any): 'movie' | 'tv' {
  if (item?.media_type === 'tv') return 'tv';
  if (item?.media_type === 'movie') return 'movie';
  if (item?.first_air_date || item?.tvShowId || item?.showId || item?.type === 'tv_episode') return 'tv';
  return 'movie';
}

export function parseTmdbId(item: any): number | null {
  const candidates = [item?.tmdbId, item?.id, item?.tvShowId, item?.showId];
  for (const c of candidates) {
    if (typeof c === 'number' && Number.isFinite(c)) return Math.trunc(c);
    if (typeof c === 'string') {
      const match = c.match(/(\d+)/);
      if (match) return Number(match[1]);
    }
  }
  return null;
}

export function extractEpisodeInfo(item: any): { seasonNumber: number; episodeNumber: number } | null {
  const seasonRaw = item?.seasonNumber ?? item?.season_number;
  const episodeRaw = item?.episodeNumber ?? item?.episode_number;
  const seasonNumber = Number(seasonRaw);
  const episodeNumber = Number(episodeRaw);

  if (Number.isInteger(seasonNumber) && seasonNumber > 0 && Number.isInteger(episodeNumber) && episodeNumber > 0) {
    return { seasonNumber, episodeNumber };
  }

  const idStr = String(item?.id || '');
  const m = idStr.match(/[sS](\d+)[eE](\d+)/);
  if (m) {
    return {
      seasonNumber: Number(m[1]),
      episodeNumber: Number(m[2]),
    };
  }

  return null;
}

export function normalizeTitle(item: any): string {
  return String(item?.title || item?.name || '').trim();
}

export function computeYear(item: any): number | null {
  const dateValue = item?.release_date || item?.first_air_date;
  if (!dateValue) return null;
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return null;
  return d.getUTCFullYear();
}

function statusPriority(s: string | null): number {
  if (s === 'completed') return 4;
  if (s === 'watching') return 3;
  if (s === 'plan_to_watch') return 2;
  if (s === 'dropped') return 1;
  return 0;
}

export function upsertLibraryAggregate(
  libraryByTitle: Map<string, LibraryAggregate>,
  args: {
    titleKey: string;
    mediaType: 'movie' | 'tv';
    sourceStatus: 'plan_to_watch' | 'watching' | 'completed' | null;
    listId?: string;
    item: any;
    watchedAt?: admin.firestore.Timestamp | null;
  },
  now: admin.firestore.Timestamp
): void {
  const existing = libraryByTitle.get(args.titleKey);
  const addedAt = toTimestamp(args.item?.dateAdded || args.item?.addedAt || now);
  const tmdbRating = typeof args.item?.vote_average === 'number' ? args.item.vote_average : null;
  const imdbRating = typeof args.item?.imdbRating === 'number' ? args.item.imdbRating : null;
  const titleLower = normalizeTitle(args.item).toLowerCase().slice(0, 200);

  if (!existing) {
    const agg: LibraryAggregate = {
      titleKey: args.titleKey,
      mediaType: args.mediaType,
      status: args.sourceStatus,
      listIds: new Set(args.listId ? [args.listId] : []),
      userRating: typeof args.item?.user_rating === 'number' ? args.item.user_rating : null,
      addedAt,
      updatedAt: now,
      lastWatchedAt: args.watchedAt || null,
      sort: {
        imdbRating,
        tmdbRating,
        popularity: typeof args.item?.popularity === 'number' ? args.item.popularity : null,
        year: computeYear(args.item),
        titleLower,
      },
    };
    libraryByTitle.set(args.titleKey, agg);
    return;
  }

  if (args.listId) existing.listIds.add(args.listId);
  if (statusPriority(args.sourceStatus) > statusPriority(existing.status)) {
    existing.status = args.sourceStatus;
  }
  if (args.watchedAt && (!existing.lastWatchedAt || args.watchedAt.toMillis() > existing.lastWatchedAt.toMillis())) {
    existing.lastWatchedAt = args.watchedAt;
  }
  if (addedAt.toMillis() < existing.addedAt.toMillis()) {
    existing.addedAt = addedAt;
  }
  existing.updatedAt = now;
}

export async function ensureEpisodeMapForTitle(
  db: FirebaseFirestore.Firestore,
  cache: Map<string, Map<string, { absoluteOrder: number }>>,
  titleKey: string,
  onFailure: (failure: MigrationFailure) => void
): Promise<Map<string, { absoluteOrder: number }>> {
  const cached = cache.get(titleKey);
  if (cached) return cached;

  const map = new Map<string, { absoluteOrder: number }>();
  try {
    const snap = await db.collection('catalog_titles').doc(titleKey).collection('episodes').get();
    for (const doc of snap.docs) {
      const d = doc.data() || {};
      const s = Number(d.seasonNumber);
      const e = Number(d.episodeNumber);
      const a = Number(d.absoluteOrder);
      if (!Number.isInteger(s) || !Number.isInteger(e) || !Number.isFinite(a)) continue;
      map.set(`${s}:${e}`, { absoluteOrder: a });
    }
  } catch (err: any) {
    onFailure({ stage: 'catalog_lookup', id: titleKey, error: String(err?.message || err) });
  }

  cache.set(titleKey, map);
  return map;
}

export function buildEpisodeStateDocId(titleKey: string, seasonNumber: number, episodeNumber: number): string {
  const s = String(seasonNumber).padStart(2, '0');
  const e = String(episodeNumber).padStart(2, '0');
  return `${titleKey}_s${s}e${e}`;
}

export function buildListItemWrite(
  userRef: FirebaseFirestore.DocumentReference,
  listId: string,
  itemKey: string,
  item: any,
  titleKey: string,
  mediaType: 'movie' | 'tv',
  now: admin.firestore.Timestamp
): PendingWrite {
  const addedAt = toTimestamp(item?.dateAdded || item?.addedAt || now);
  const displayTitle = normalizeTitle(item).slice(0, 200) || titleKey;

  return {
    ref: userRef.collection('lists').doc(listId).collection('items').doc(itemKey),
    data: {
      titleKey,
      mediaType,
      addedAt,
      position: Number(item?.position) || addedAt.toMillis(),
      sort: {
        imdbRating: typeof item?.imdbRating === 'number' ? item.imdbRating : null,
        tmdbRating: typeof item?.vote_average === 'number' ? item.vote_average : null,
        popularity: typeof item?.popularity === 'number' ? item.popularity : null,
        year: computeYear(item),
        titleLower: displayTitle.toLowerCase(),
      },
      display: {
        title: displayTitle,
        posterPath: item?.poster_path || null,
        releaseDate: item?.release_date || item?.first_air_date || null,
      },
    },
    merge: true,
  };
}

export async function commitWritesInChunks(
  db: FirebaseFirestore.Firestore,
  writes: PendingWrite[],
  onFailure: (failure: MigrationFailure) => void,
  chunkSize = 450
): Promise<void> {
  for (let i = 0; i < writes.length; i += chunkSize) {
    const chunk = writes.slice(i, i + chunkSize);
    const batch = db.batch();
    for (const w of chunk) {
      if (w.merge) {
        batch.set(w.ref, w.data, { merge: true });
      } else {
        batch.set(w.ref, w.data);
      }
    }
    try {
      await batch.commit();
    } catch (err: any) {
      onFailure({ stage: 'batch_commit', error: String(err?.message || err) });
    }
  }
}