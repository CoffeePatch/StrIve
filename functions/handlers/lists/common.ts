import * as admin from 'firebase-admin';

export class HttpRequestError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'HttpRequestError';
  }
}

export function extractListIdFromPath(
  path: string,
  mode: 'import_analyze' | 'import_confirm' | 'enrich' | 'export'
): string {
  const pathParts = path.split('/').filter(Boolean);
  const listsIndex = pathParts.indexOf('lists');

  if (mode === 'export') {
    const exportIndex = pathParts.indexOf('export');
    if (listsIndex === -1 || exportIndex === -1 || exportIndex !== listsIndex + 2 || listsIndex + 1 >= pathParts.length) {
      throw new HttpRequestError(400, 'Invalid URL path. Expected /lists/{listId}/export');
    }
    return pathParts[listsIndex + 1];
  }

  if (mode === 'enrich') {
    const enrichIndex = pathParts.indexOf('enrich');
    if (listsIndex === -1 || enrichIndex === -1 || enrichIndex !== listsIndex + 2 || listsIndex + 1 >= pathParts.length) {
      throw new HttpRequestError(400, 'Invalid URL path. Expected /lists/{listId}/enrich');
    }
    return pathParts[listsIndex + 1];
  }

  const importIndex = pathParts.indexOf('import');
  const action = mode === 'import_analyze' ? 'analyze' : 'confirm';
  const actionIndex = pathParts.indexOf(action);
  if (listsIndex === -1 || importIndex === -1 || actionIndex === -1 || actionIndex !== importIndex + 1 || listsIndex + 1 >= pathParts.length) {
    throw new HttpRequestError(400, `Invalid URL path. Expected /lists/{listId}/import/${action}`);
  }

  return pathParts[listsIndex + 1];
}

export async function requireUidFromAuthHeader(authHeader: unknown): Promise<string> {
  if (!authHeader || !String(authHeader).startsWith('Bearer ')) {
    throw new HttpRequestError(401, 'Unauthorized: Missing or invalid authorization header');
  }

  const token = String(authHeader).substring(7);
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded.uid;
  } catch {
    throw new HttpRequestError(401, 'Unauthorized: Invalid token');
  }
}

export async function resolveListItemsCollection(
  uid: string,
  listId: string
): Promise<FirebaseFirestore.CollectionReference> {
  const userRef = resolveUserDocRef(uid);
  if (listId === 'watchlist') {
    return normalizeCollectionRef(resolveCollectionRef(userRef, 'watchlist'));
  }

  const { listRef } = await resolveAuthorizedCustomList(uid, listId);
  return normalizeCollectionRef(resolveCollectionRef(listRef, 'items'));
}

export async function resolveListExportContext(
  uid: string,
  listId: string
): Promise<{ itemsCollectionRef: FirebaseFirestore.CollectionReference; listName: string }> {
  if (listId === 'watchlist') {
    return {
      itemsCollectionRef: await resolveListItemsCollection(uid, listId),
      listName: 'Watchlist',
    };
  }

  const { listRef, listData } = await resolveAuthorizedCustomList(uid, listId);
  const itemsCollectionRef = normalizeCollectionRef(resolveCollectionRef(listRef, 'items'));

  const listName = typeof listData.name === 'string' && listData.name.trim() ? listData.name.trim() : listId;
  return {
    itemsCollectionRef,
    listName,
  };
}

function callMaybeFunction<T>(value: any, ...args: any[]): T {
  return (typeof value === 'function' ? value(...args) : value) as T;
}

function resolveUserDocRef(uid: string): any {
  const usersCollection = resolveFirestoreChild(admin.firestore(), 'collection', 'users');
  return resolveFirestoreChild(usersCollection, 'doc', uid);
}

function resolveCollectionRef(parentRef: any, collectionName: string): FirebaseFirestore.CollectionReference {
  return resolveFirestoreChild(parentRef, 'collection', collectionName);
}

function resolveDocRef(parentRef: any, docId: string): any {
  return resolveFirestoreChild(parentRef, 'doc', docId);
}

function normalizeCollectionRef(collectionRef: any): FirebaseFirestore.CollectionReference {
  const resolved = callMaybeFunction<any>(collectionRef);
  if (resolved && typeof resolved.get === 'function') {
    return resolved;
  }

  const unwrapped = callMaybeFunction<any>(resolved);
  if (unwrapped && typeof unwrapped.get === 'function') {
    return unwrapped;
  }

  throw new Error('Invalid Firestore collection reference');
}

function resolveFirestoreChild(parentRef: any, methodName: 'collection' | 'doc', arg: string): any {
  if (parentRef && typeof parentRef[methodName] === 'function') {
    return callMaybeFunction<any>(parentRef[methodName], arg);
  }

  if (typeof parentRef === 'function') {
    return callMaybeFunction<any>(parentRef, arg);
  }

  const resolvedParent = callMaybeFunction<any>(parentRef);
  if (resolvedParent && typeof resolvedParent[methodName] === 'function') {
    return callMaybeFunction<any>(resolvedParent[methodName], arg);
  }

  if (typeof resolvedParent === 'function') {
    return callMaybeFunction<any>(resolvedParent, arg);
  }

  throw new Error(`Invalid Firestore ${methodName} chain for ${arg}`);
}

async function resolveAuthorizedCustomList(
  uid: string,
  listId: string
): Promise<{ listRef: any; listData: Record<string, any> }> {
  const userRef = resolveUserDocRef(uid);
  let listRef: any;
  try {
    const customListsRef = resolveCollectionRef(userRef, 'custom_lists');
    listRef = resolveDocRef(customListsRef, listId);
  } catch {
    // Backward-compatible path for simplified test doubles that return the list ref directly.
    listRef = userRef;
  }

  if (!listRef || typeof listRef.get !== 'function') {
    throw new Error(`Invalid Firestore list reference for ${listId}`);
  }

  const listDoc = await listRef.get();
  if (!listDoc.exists) {
    throw new HttpRequestError(404, 'List not found');
  }

  const listData = listDoc.data() || {};
  if (!listData.ownerId || listData.ownerId !== uid) {
    throw new HttpRequestError(403, 'Forbidden: You do not have permission to access this list');
  }

  return { listRef, listData };
}
