"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.walkLayer = void 0;
function walkLayer(layer, segments) {
    let cur = layer;
    for (const seg of segments) {
        if (typeof cur === 'function')
            cur = cur();
        if (typeof cur === 'function') {
            cur = cur(seg);
            continue;
        }
        if (cur && typeof cur.collection === 'function') {
            cur = cur.collection(seg);
            continue;
        }
        if (cur && typeof cur.doc === 'function') {
            cur = cur.doc(seg);
            continue;
        }
    }
    if (typeof cur === 'function')
        cur = cur();
    return cur;
}
exports.walkLayer = walkLayer;
//# sourceMappingURL=firestoreWalk.js.map