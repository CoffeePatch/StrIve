import "dotenv/config";
import admin from "firebase-admin";
import process from "node:process";

const args = process.argv.slice(2);
const getArgValue = (flag) => {
  const idx = args.indexOf(flag);
  if (idx === -1) return null;
  return args[idx + 1] || null;
};

const uid = getArgValue("--uid") || process.env.BACKFILL_UID;
const allowProduction = args.includes("--allow-production");
const apply = args.includes("--apply");
const recount = args.includes("--recount");

if (!uid) {
  console.error("Missing user id. Use --uid <uid> or set BACKFILL_UID.");
  process.exit(1);
}

if (!process.env.FIRESTORE_EMULATOR_HOST && !allowProduction) {
  console.error(
    "Refusing to run against production. Set FIRESTORE_EMULATOR_HOST or pass --allow-production."
  );
  process.exit(1);
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, or FIREBASE_PRIVATE_KEY.");
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = admin.firestore();

const inferKind = (listId) => {
  if (listId === "watchlist") return "system_watchlist";
  if (listId === "watched") return "system_watched";
  if (listId === "favorites") return "favorites";
  return "custom";
};

const countListItems = async (listId) => {
  const snap = await db
    .collection("users")
    .doc(uid)
    .collection("library_items")
    .where("tracking.listIds", "array-contains", listId)
    .get();
  return snap.size;
};

const listsRef = db.collection("users").doc(uid).collection("lists");
const listSnap = await listsRef.get();

if (listSnap.empty) {
  console.log("No lists found for user:", uid);
  process.exit(0);
}

const updates = [];

for (const doc of listSnap.docs) {
  const data = doc.data() || {};
  const patch = {};

  if (!("description" in data)) patch.description = "";
  if (!("kind" in data)) patch.kind = inferKind(doc.id);
  if (!("visibility" in data)) patch.visibility = "private";
  if (!("isPinned" in data)) patch.isPinned = false;
  if (!("itemCount" in data) || recount) {
    patch.itemCount = await countListItems(doc.id);
  }
  if (!("createdAt" in data)) {
    patch.createdAt = admin.firestore.FieldValue.serverTimestamp();
  }
  if (!("updatedAt" in data)) {
    patch.updatedAt = admin.firestore.FieldValue.serverTimestamp();
  }
  if (!("ownerId" in data)) patch.ownerId = uid;

  if (Object.keys(patch).length > 0) {
    updates.push({ ref: doc.ref, patch, listId: doc.id });
  }
}

if (updates.length === 0) {
  console.log("No list updates needed for user:", uid);
  process.exit(0);
}

if (!apply) {
  console.log("Dry run. Use --apply to write changes.");
  console.log(
    updates.map((u) => ({ listId: u.listId, patch: u.patch }))
  );
  process.exit(0);
}

let batch = db.batch();
let opCount = 0;
let committed = 0;

for (const update of updates) {
  batch.set(update.ref, update.patch, { merge: true });
  opCount += 1;
  if (opCount >= 400) {
    await batch.commit();
    committed += opCount;
    batch = db.batch();
    opCount = 0;
  }
}

if (opCount > 0) {
  await batch.commit();
  committed += opCount;
}

console.log(`Updated ${committed} list document(s) for user ${uid}.`);
