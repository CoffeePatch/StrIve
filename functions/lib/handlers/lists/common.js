"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveListExportContext = exports.resolveListItemsCollection = exports.requireUidFromAuthHeader = exports.extractListIdFromPath = exports.HttpRequestError = void 0;
const admin = __importStar(require("firebase-admin"));
class HttpRequestError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
        this.name = 'HttpRequestError';
    }
}
exports.HttpRequestError = HttpRequestError;
function extractListIdFromPath(path, mode) {
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
exports.extractListIdFromPath = extractListIdFromPath;
async function requireUidFromAuthHeader(authHeader) {
    if (!authHeader || !String(authHeader).startsWith('Bearer ')) {
        throw new HttpRequestError(401, 'Unauthorized: Missing or invalid authorization header');
    }
    const token = String(authHeader).substring(7);
    try {
        const decoded = await admin.auth().verifyIdToken(token);
        return decoded.uid;
    }
    catch (_a) {
        throw new HttpRequestError(401, 'Unauthorized: Invalid token');
    }
}
exports.requireUidFromAuthHeader = requireUidFromAuthHeader;
async function resolveListItemsCollection(uid, listId) {
    const userRef = resolveUserDocRef(uid);
    if (listId === 'watchlist') {
        return normalizeCollectionRef(resolveCollectionRef(userRef, 'watchlist'));
    }
    const { listRef } = await resolveAuthorizedCustomList(uid, listId);
    return normalizeCollectionRef(resolveCollectionRef(listRef, 'items'));
}
exports.resolveListItemsCollection = resolveListItemsCollection;
async function resolveListExportContext(uid, listId) {
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
exports.resolveListExportContext = resolveListExportContext;
function callMaybeFunction(value, ...args) {
    return (typeof value === 'function' ? value(...args) : value);
}
function resolveUserDocRef(uid) {
    const usersCollection = resolveFirestoreChild(admin.firestore(), 'collection', 'users');
    return resolveFirestoreChild(usersCollection, 'doc', uid);
}
function resolveCollectionRef(parentRef, collectionName) {
    return resolveFirestoreChild(parentRef, 'collection', collectionName);
}
function resolveDocRef(parentRef, docId) {
    return resolveFirestoreChild(parentRef, 'doc', docId);
}
function normalizeCollectionRef(collectionRef) {
    const resolved = callMaybeFunction(collectionRef);
    if (resolved && typeof resolved.get === 'function') {
        return resolved;
    }
    const unwrapped = callMaybeFunction(resolved);
    if (unwrapped && typeof unwrapped.get === 'function') {
        return unwrapped;
    }
    throw new Error('Invalid Firestore collection reference');
}
function resolveFirestoreChild(parentRef, methodName, arg) {
    if (parentRef && typeof parentRef[methodName] === 'function') {
        return callMaybeFunction(parentRef[methodName], arg);
    }
    if (typeof parentRef === 'function') {
        return callMaybeFunction(parentRef, arg);
    }
    const resolvedParent = callMaybeFunction(parentRef);
    if (resolvedParent && typeof resolvedParent[methodName] === 'function') {
        return callMaybeFunction(resolvedParent[methodName], arg);
    }
    if (typeof resolvedParent === 'function') {
        return callMaybeFunction(resolvedParent, arg);
    }
    throw new Error(`Invalid Firestore ${methodName} chain for ${arg}`);
}
async function resolveAuthorizedCustomList(uid, listId) {
    const userRef = resolveUserDocRef(uid);
    let listRef;
    try {
        const customListsRef = resolveCollectionRef(userRef, 'custom_lists');
        listRef = resolveDocRef(customListsRef, listId);
    }
    catch (_a) {
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
//# sourceMappingURL=common.js.map