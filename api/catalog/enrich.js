import { verifyAuth } from "../_lib/authMiddleware.js";
import { sendError } from "../_lib/utils.js";
import { ensureCatalogTitle } from "../_lib/services/catalogService.js";

const MAX_ENRICH_BATCH_SIZE = 50;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendError(res, 405, "method-not-allowed", "Only POST requests are allowed");
  }

  try {
    await verifyAuth(req);
  } catch (err) {
    return sendError(res, 401, "unauthenticated", err?.message || "Authentication required");
  }

  const { titleKeys = [], forceRefresh = false } = req.body || {};

  if (!Array.isArray(titleKeys) || titleKeys.length === 0) {
    return sendError(res, 400, "invalid-payload", "Array of titleKeys is required for enrichment");
  }

  if (titleKeys.length > MAX_ENRICH_BATCH_SIZE) {
    return sendError(res, 400, "batch-limit-exceeded", `Enrichment batch size exceeds limit of ${MAX_ENRICH_BATCH_SIZE} items`);
  }

  try {
    const results = [];
    let enrichedCount = 0;
    let reusedCount = 0;

    for (const titleKey of titleKeys) {
      if (!titleKey || typeof titleKey !== "string") continue;

      const result = await ensureCatalogTitle(titleKey, {}, { forceRefresh });
      if (result) {
        results.push(result);
        if (forceRefresh) {
          enrichedCount++;
        } else {
          reusedCount++;
        }
      }
    }

    return res.status(200).json({
      success: true,
      summary: {
        totalRequested: titleKeys.length,
        processed: results.length,
        enriched: enrichedCount,
        reused: reusedCount,
      },
      catalog: results,
    });
  } catch (err) {
    console.error("Error in /api/catalog/enrich:", err);
    return sendError(res, 500, "internal", "Failed to process catalog metadata enrichment");
  }
}
