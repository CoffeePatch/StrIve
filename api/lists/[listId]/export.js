import { verifyAuth } from "../../../_lib/authMiddleware.js";
import { sendError, pLimit } from "../../../_lib/utils.js";
import { escapeCsvField } from "../../../_lib/csv.js";
import {
  resolveListExportContext,
  enrichItem,
  HttpRequestError,
} from "../../../_lib/listUtils.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return sendError(res, 405, "method-not-allowed", "Method not allowed");
  }

  try {
    const { listId } = req.query;
    if (!listId) {
      return sendError(res, 400, "invalid-argument", "List ID is required");
    }

    const uid = (await verifyAuth(req)).uid;
    const { itemsCollectionRef, listName } = await resolveListExportContext(
      uid,
      listId,
    );
    const itemsSnapshot = await itemsCollectionRef.get();

    if (!itemsSnapshot || itemsSnapshot.empty) {
      res.setHeader("Cache-Control", "no-cache");
      return res.status(204).end();
    }

    const tmdbToken = process.env.TMDB_READ_ACCESS_TOKEN;
    const limit = pLimit(8);
    const enriched = await Promise.all(
      itemsSnapshot.docs
        .map((d) => d.data())
        .map((item) => limit(() => enrichItem(item, tmdbToken))),
    );

    const header =
      "tmdbId,imdbId,name,year,mediaType,tmdbRating,imdbRating,tmdbVotes,imdbVotes";
    const rows = enriched.map((r) =>
      [
        escapeCsvField(String(r.tmdbId ?? "")),
        escapeCsvField(r.imdbId || ""),
        escapeCsvField(r.name || ""),
        escapeCsvField(r.year || ""),
        escapeCsvField(r.mediaType || ""),
        escapeCsvField(r.tmdbRating || ""),
        escapeCsvField(r.imdbRating || ""),
        escapeCsvField(r.tmdbVotes || ""),
        escapeCsvField(r.imdbVotes || ""),
      ].join(","),
    );

    const csv = [header, ...rows].join("\n");

    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    const d = String(now.getUTCDate()).padStart(2, "0");
    const dateStr = `${y}${m}${d}`;
    const safeName = listName.replace(/[\n\r]/g, " ").trim();
    const filename = `${safeName}-${dateStr}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-cache");
    return res.status(200).send(csv);
  } catch (error) {
    if (error instanceof HttpRequestError) {
      return sendError(res, error.status, "failed", error.message);
    }
    console.error("Error exporting list CSV:", error);
    return sendError(res, 500, "internal", "Internal server error");
  }
}
