import Papa from "papaparse";
import busboy from "busboy";
import { fetchWithTimeout, sendError, pLimit } from "../../../../_lib/utils.js";
import {
  resolveListItemsCollection,
  HttpRequestError,
  requireUidFromAuthHeader,
} from "../../../../_lib/listUtils.js";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendError(res, 405, "method-not-allowed", "Method not allowed");
  }

  try {
    const { listId } = req.query;
    if (!listId) {
      return sendError(res, 400, "invalid-argument", "List ID is required");
    }

    const uid = await requireUidFromAuthHeader(req.headers.authorization);
    const itemsCollectionRef = await resolveListItemsCollection(uid, listId);

    const contentType =
      req.headers["content-type"] || req.headers["Content-Type"];
    if (!contentType || !contentType.includes("multipart/form-data")) {
      return sendError(
        res,
        400,
        "invalid-argument",
        "Content-Type must be multipart/form-data",
      );
    }

    const EXPECTED_HEADERS = [
      "tmdbId",
      "imdbId",
      "name",
      "year",
      "mediaType",
      "tmdbRating",
      "imdbRating",
      "tmdbVotes",
      "imdbVotes",
    ];
    const bb = busboy({ headers: req.headers });
    let csvBuffer = null;
    let fileCount = 0;

    bb.on("file", (name, file, info) => {
      const { filename, mimeType } = info;
      if (mimeType === "text/csv" || (filename && filename.endsWith(".csv"))) {
        fileCount++;
        const buffers = [];
        file.on("data", (data) => buffers.push(data));
        file.on("end", () => {
          csvBuffer = Buffer.concat(buffers);
        });
      } else {
        file.resume();
      }
    });

    bb.on("close", async () => {
      if (!csvBuffer || fileCount !== 1) {
        return sendError(
          res,
          400,
          "invalid-argument",
          "Exactly one CSV file is required",
        );
      }

      try {
        const csvString = csvBuffer.toString("utf8");
        const parsed = Papa.parse(csvString, {
          header: true,
          skipEmptyLines: true,
        });
        const fields = parsed?.meta?.fields || [];

        if (
          fields.length !== EXPECTED_HEADERS.length ||
          !fields.every((f, i) => f === EXPECTED_HEADERS[i])
        ) {
          if (
            fields.includes("Letterboxd URI") ||
            fields.includes("Name") ||
            (fields.includes("Year") && !fields.includes("year"))
          ) {
            return sendError(
              res,
              400,
              "invalid-argument",
              "Legacy CSV headers detected. Expected: " +
                EXPECTED_HEADERS.join(","),
            );
          }
          return sendError(
            res,
            400,
            "invalid-argument",
            "Invalid CSV headers. Expected exact columns: " +
              EXPECTED_HEADERS.join(","),
          );
        }

        const existingSnapshot = await itemsCollectionRef.get();
        const existingById = new Map();
        const existingByNameYear = new Set();
        existingSnapshot.docs.forEach((d) => {
          const it = d.data();
          if (it?.id) existingById.set(String(it.id), it);
          const n = (it?.title || it?.name || "").trim();
          const y = (it?.release_date || it?.first_air_date || "").slice(0, 4);
          if (n && y) existingByNameYear.add(`${n}::${y}`);
        });

        const tmdbToken = process.env.TMDB_READ_ACCESS_TOKEN;
        const limit = pLimit(6);

        async function tmdbFindByImdb(imdbId, mt) {
          if (!tmdbToken || !imdbId) return null;
          const url = `https://api.themoviedb.org/3/find/${encodeURIComponent(imdbId)}?external_source=imdb_id`;
          try {
            const r = await fetchWithTimeout(
              url,
              { headers: { Authorization: `Bearer ${tmdbToken}` } },
              8000,
            );
            if (!r.ok) return null;
            const j = await r.json();
            const arr = mt === "movie" ? j?.movie_results : j?.tv_results;
            return Array.isArray(arr) && arr[0] ? arr[0] : null;
          } catch {
            return null;
          }
        }

        async function tmdbSearchByNameYear(name, year, mt) {
          if (!tmdbToken || !name) return null;
          const base = `https://api.themoviedb.org/3/search/${mt}`;
          const q = new URLSearchParams({ query: name });
          if (year)
            q.set(mt === "movie" ? "year" : "first_air_date_year", year);
          const url = `${base}?${q.toString()}`;
          try {
            const r = await fetchWithTimeout(
              url,
              { headers: { Authorization: `Bearer ${tmdbToken}` } },
              8000,
            );
            if (!r.ok) return null;
            const j = await r.json();
            return Array.isArray(j?.results) && j.results[0]
              ? j.results[0]
              : null;
          } catch {
            return null;
          }
        }

        async function tmdbDetails(mt, id) {
          if (!tmdbToken || !id) return null;
          const url = `https://api.themoviedb.org/3/${mt}/${id}`;
          try {
            const r = await fetchWithTimeout(
              url,
              { headers: { Authorization: `Bearer ${tmdbToken}` } },
              8000,
            );
            if (!r.ok) return null;
            return await r.json();
          } catch {
            return null;
          }
        }

        const rows = parsed.data;
        const result = { matched: [], unmatched: [], duplicates: [] };

        await Promise.all(
          rows.map((row) =>
            limit(async () => {
              const tmdbIdRaw = String(row.tmdbId || "").trim();
              const imdbIdRaw = String(row.imdbId || "").trim();
              const name = String(row.name || "").trim();
              const year = String(row.year || "").trim();
              const mt =
                String(row.mediaType || "").trim() === "tv" ? "tv" : "movie";

              if (tmdbIdRaw && existingById.has(tmdbIdRaw)) {
                const it = existingById.get(tmdbIdRaw);
                result.duplicates.push({
                  movie: {
                    id: it.id,
                    title: it.title || it.name,
                    release_date: it.release_date,
                    first_air_date: it.first_air_date,
                    media_type: it.media_type,
                    poster_path: it.poster_path,
                  },
                  originalRow: row,
                });
                return;
              }

              if (
                !tmdbIdRaw &&
                name &&
                year &&
                existingByNameYear.has(`${name}::${year}`)
              ) {
                const it = [...existingById.values()].find(
                  (v) =>
                    (v.title || v.name) === name &&
                    (v.release_date || v.first_air_date || "").startsWith(year),
                );
                if (it) {
                  result.duplicates.push({
                    movie: {
                      id: it.id,
                      title: it.title || it.name,
                      release_date: it.release_date,
                      first_air_date: it.first_air_date,
                      media_type: it.media_type,
                      poster_path: it.poster_path,
                    },
                    originalRow: row,
                  });
                  return;
                }
              }

              let resolved = null;
              if (tmdbIdRaw) {
                resolved = await tmdbDetails(mt, tmdbIdRaw);
              } else if (imdbIdRaw) {
                const found = await tmdbFindByImdb(imdbIdRaw, mt);
                if (found?.id) resolved = await tmdbDetails(mt, found.id);
              } else if (name) {
                const found = await tmdbSearchByNameYear(name, year, mt);
                if (found?.id) resolved = await tmdbDetails(mt, found.id);
              }

              if (resolved?.id) {
                result.matched.push({
                  movie: {
                    id: resolved.id,
                    title: resolved.title || resolved.name,
                    release_date: resolved.release_date,
                    first_air_date: resolved.first_air_date,
                    media_type: mt,
                    poster_path: resolved.poster_path,
                  },
                  originalRow: row,
                });
              } else {
                result.unmatched.push({ row, reason: "Not found in TMDB" });
              }
            }),
          ),
        );

        return res.status(200).json(result);
      } catch (parseError) {
        console.error("Error parsing CSV:", parseError);
        return sendError(res, 400, "invalid-argument", "Invalid CSV format");
      }
    });

    req.pipe(bb);
  } catch (error) {
    if (error instanceof HttpRequestError) {
      return sendError(res, error.status, "failed", error.message);
    }
    console.error("Error analyzing CSV for import:", error);
    return sendError(res, 500, "internal", "Internal server error");
  }
}
