"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setCache = exports.getCached = void 0;
const tvCache = new Map();
const CACHE_TTL_MS = 10 * 60 * 1000;
function getCached(key) {
    const entry = tvCache.get(key);
    if (!entry)
        return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        tvCache.delete(key);
        return null;
    }
    return entry.data;
}
exports.getCached = getCached;
function setCache(key, data) {
    tvCache.set(key, { data, timestamp: Date.now() });
}
exports.setCache = setCache;
//# sourceMappingURL=tvCache.js.map