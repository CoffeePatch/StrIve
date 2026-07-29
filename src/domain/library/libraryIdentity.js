export const createLibraryIdentity = ({ titleKey, mediaType, tmdbId }) => {
  if (typeof titleKey !== 'string' || !titleKey.trim()) {
    throw new Error('Missing library titleKey');
  }

  const normalizedMediaType = mediaType === 'tv' ? 'tv' : mediaType === 'movie' ? 'movie' : null;
  if (!normalizedMediaType) {
    throw new Error('Missing library mediaType');
  }

  const normalizedTmdbId = Number(tmdbId);
  if (!Number.isFinite(normalizedTmdbId)) {
    throw new Error('Missing library tmdbId');
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
