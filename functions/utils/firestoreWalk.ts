export function walkLayer(layer: any, segments: any[]): any {
  let cur: any = layer;
  for (const seg of segments) {
    if (typeof cur === 'function') cur = cur();
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
  if (typeof cur === 'function') cur = cur();
  return cur;
}
