"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pLimit = exports.fetchWithTimeout = void 0;
async function fetchWithTimeout(resource, options = {}, timeoutMs = 8000) {
    const f = globalThis.fetch;
    return await Promise.race([
        f(resource, options || {}),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeoutMs)),
    ]);
}
exports.fetchWithTimeout = fetchWithTimeout;
function pLimit(concurrency) {
    let activeCount = 0;
    const queue = [];
    const next = () => {
        activeCount--;
        if (queue.length > 0)
            queue.shift()();
    };
    const run = async (fn) => {
        if (activeCount >= concurrency) {
            await new Promise((resolve) => queue.push(resolve));
        }
        activeCount++;
        try {
            return await fn();
        }
        finally {
            next();
        }
    };
    return run;
}
exports.pLimit = pLimit;
//# sourceMappingURL=net.js.map