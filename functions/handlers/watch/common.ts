import { HttpsError } from 'firebase-functions/v2/https';

type SafeHttpsCode =
  | 'invalid-argument'
  | 'failed-precondition'
  | 'not-found'
  | 'aborted'
  | 'already-exists'
  | 'permission-denied'
  | 'resource-exhausted'
  | 'internal';

const SAFE_CODES: SafeHttpsCode[] = [
  'invalid-argument',
  'failed-precondition',
  'not-found',
  'aborted',
  'already-exists',
  'permission-denied',
  'resource-exhausted',
  'internal',
];

export function requireAuthUid(auth: { uid?: string } | undefined): string {
  const uid = auth?.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Authentication is required.');
  }
  return uid;
}

export function parseTvTitleKey(rawTitleKey: unknown): string {
  const titleKey = typeof rawTitleKey === 'string' ? rawTitleKey.trim() : '';
  if (!/^tmdb_tv_\d+$/.test(titleKey)) {
    throw new HttpsError('invalid-argument', 'titleKey must match tmdb_tv_<id>.');
  }
  return titleKey;
}

export function toSafeHttpsError(err: any, fallbackMessage: string): HttpsError {
  if (err instanceof HttpsError) {
    return err;
  }

  const rawCode = typeof err?.code === 'string' ? String(err.code).replace('functions/', '') : 'internal';
  const safeCode = SAFE_CODES.includes(rawCode as SafeHttpsCode)
    ? (rawCode as SafeHttpsCode)
    : 'internal';

  const safeMessage = typeof err?.message === 'string' && err.message.trim()
    ? err.message
    : fallbackMessage;

  return new HttpsError(safeCode, safeMessage);
}
