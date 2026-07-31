export const createLibraryIdentity = ({ titleKey, mediaType, media_type, tmdbId, id }) => {
  if (typeof titleKey !== 'string' || !titleKey.trim()) {
    throw new Error('Missing library titleKey');
  }

  const actualMediaType = mediaType || media_type;
  const normalizedMediaType = actualMediaType === 'tv' ? 'tv' : actualMediaType === 'movie' ? 'movie' : null;
  if (!normalizedMediaType) {
    throw new Error(`Missing library mediaType for item: ${titleKey}`);
  }

  const actualTmdbId = tmdbId ?? id;
  let normalizedTmdbId = Number(actualTmdbId);
  
  // If parsing as number fails (e.g. composite IDs like 110316_S3E3), gracefully keep the string
  if (!Number.isFinite(normalizedTmdbId)) {
    normalizedTmdbId = actualTmdbId;
  }

  if (normalizedTmdbId == null || normalizedTmdbId === '') {
    throw new Error(`Missing library tmdbId for item: ${titleKey}`);
  }

  return {
    titleKey: titleKey.trim(),
    mediaType: normalizedMediaType,
    tmdbId: normalizedTmdbId,
  };
};

export const readLibraryIdentity = (libraryIdentity) => {
  if (!libraryIdentity || typeof libraryIdentity !== 'object') {
    throw new Error('Missing library identity');
  }

  return createLibraryIdentity(libraryIdentity);
};
