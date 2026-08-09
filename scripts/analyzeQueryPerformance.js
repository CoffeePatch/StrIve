import fs from "node:fs";
import dotenv from "dotenv";

if (fs.existsSync(".env.local")) {
  dotenv.config({ path: ".env.local" });
} else {
  dotenv.config();
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const mode = process.argv.includes("--indexed") ? "INDEXED" : "BASELINE";

async function runExplain(label, queryRaw) {
  console.log(`--------------------------------------------------`);
  console.log(`📌 Query: ${label} [${mode} MODE]`);
  console.log(`--------------------------------------------------`);

  try {
    const planResult = await prisma.$queryRawUnsafe(`EXPLAIN (ANALYZE, BUFFERS) ${queryRaw}`);
    const planText = planResult.map((row) => row["QUERY PLAN"]).join("\n");
    console.log(planText);
    console.log("");
    return planText;
  } catch (err) {
    console.error(`❌ Query benchmark failed for '${label}':`, err.message);
    return null;
  }
}

async function main() {
  console.log("==================================================");
  console.log(`Empirical Query Performance Benchmark [${mode}]`);
  console.log("==================================================\n");

  const userId = "test_user_1";

  // Query 1: Library View (Status = watching, sorted by added_at DESC)
  await runExplain(
    "1. Library View (Filter Status='watching', ORDER BY added_at DESC)",
    `SELECT uli.*, ct.title, ct.poster_path 
     FROM user_library_items uli 
     JOIN catalog_titles ct ON uli.title_key = ct.title_key 
     WHERE uli.user_id = '${userId}' AND uli.status = 'watching' 
     ORDER BY uli.added_at DESC 
     LIMIT 50;`
  );

  // Query 2: Continue Watching (Status = watching, sorted by last_watched_at DESC)
  await runExplain(
    "2. Continue Watching Carousel (Status='watching', ORDER BY last_watched_at DESC)",
    `SELECT uli.*, ct.title, ct.poster_path 
     FROM user_library_items uli 
     JOIN catalog_titles ct ON uli.title_key = ct.title_key 
     WHERE uli.user_id = '${userId}' AND uli.status = 'watching' 
     ORDER BY uli.last_watched_at DESC NULLS LAST 
     LIMIT 20;`
  );

  // Query 3: Catalog Title Search (Typo/Fuzzy Search)
  await runExplain(
    "3. Catalog Fuzzy Title Search (ILIKE '%Movie 12%')",
    `SELECT title_key, title, release_date, poster_path 
     FROM catalog_titles 
     WHERE title ILIKE '%Movie 12%' 
     LIMIT 20;`
  );

  // Query 4: Genre Array Containment Filter
  await runExplain(
    "4. Genre Array Filter (genres @> ARRAY['Action'])",
    `SELECT title_key, title, genres 
     FROM catalog_titles 
     WHERE genres @> ARRAY['Action'] 
     LIMIT 50;`
  );

  // Query 5: Custom List Positional Ordering
  await runExplain(
    "5. Custom List Item Ordering (ORDER BY position ASC)",
    `SELECT uli.*, ct.title 
     FROM user_list_items uli 
     JOIN catalog_titles ct ON uli.title_key = ct.title_key 
     WHERE uli.list_id = 'list_benchmark_1' 
     ORDER BY uli.position ASC 
     LIMIT 50;`
  );

  // Query 6: Series Progress View Query
  await runExplain(
    "6. TV Series Progress View (SELECT FROM user_series_progress_view)",
    `SELECT * 
     FROM user_series_progress_view 
     WHERE user_id = '${userId}' 
     LIMIT 50;`
  );

  console.log("==================================================");
  console.log(`BENCHMARK [${mode}] COMPLETE ✅`);
  console.log("==================================================");

  await prisma.$disconnect();
}

main();
