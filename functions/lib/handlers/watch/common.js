"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toSafeHttpsError = exports.parseTvTitleKey = exports.requireAuthUid = void 0;
const https_1 = require("firebase-functions/v2/https");
const SAFE_CODES = [
    'invalid-argument',
    'failed-precondition',
    'not-found',
    'aborted',
    'already-exists',
    'permission-denied',
    'resource-exhausted',
    'internal',
];
function requireAuthUid(auth) {
    const uid = auth === null || auth === void 0 ? void 0 : auth.uid;
    if (!uid) {
        throw new https_1.HttpsError('unauthenticated', 'Authentication is required.');
    }
    return uid;
}
exports.requireAuthUid = requireAuthUid;
function parseTvTitleKey(rawTitleKey) {
    const titleKey = typeof rawTitleKey === 'string' ? rawTitleKey.trim() : '';
    if (!/^tmdb_tv_\d+$/.test(titleKey)) {
        throw new https_1.HttpsError('invalid-argument', 'titleKey must match tmdb_tv_<id>.');
    }
    return titleKey;
}
exports.parseTvTitleKey = parseTvTitleKey;
function toSafeHttpsError(err, fallbackMessage) {
    if (err instanceof https_1.HttpsError) {
        return err;
    }
    const rawCode = typeof (err === null || err === void 0 ? void 0 : err.code) === 'string' ? String(err.code).replace('functions/', '') : 'internal';
    const safeCode = SAFE_CODES.includes(rawCode)
        ? rawCode
        : 'internal';
    const safeMessage = typeof (err === null || err === void 0 ? void 0 : err.message) === 'string' && err.message.trim()
        ? err.message
        : fallbackMessage;
    return new https_1.HttpsError(safeCode, safeMessage);
}
exports.toSafeHttpsError = toSafeHttpsError;
//# sourceMappingURL=common.js.map