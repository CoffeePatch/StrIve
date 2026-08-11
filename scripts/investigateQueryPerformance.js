import fs from "node:fs";
import dotenv from "dotenv";

if (fs.existsSync(".env.local")) {
  dotenv.config({ path: ".env.local" });
} else {
  dotenv.config();
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function runExplain(label, queryRaw) {
  console.log("--------------------------------------------------");
  console.log(`🔍 Investigation: ${label}`);
  console.log("--------------------------------------------------");

  try {
    const planResult = await prisma.$queryRawUnsafe(`EXPLAIN (ANALYZE, BUFFERS) ${queryRaw}`);
    const planText = planResult.map((row) => row["QUERY PLAN"]).join("\n");
    console.log(planText);
    console.log("");
    return planText;
  } catch (err) {
    console.error(`❌ Investigation failed for '${label}':`, err.message);
    return null;
  }
}

async function main() {
  console.log("==================================================");
  console.log("Phase 3.3.1 Deep-Dive Query Investigation");
  console.log("==================================================\n");

  const userId = "test_user_1";
  const sampleTitleKey = "tmdb_tv_2501";

  // Part 1: Continue Watching Diagnostics
  console.log("=== PART 1: CONTINUE WATCHING DIAGNOSTICS ===\n");

  await runExplain(
    "1A. Continue Watching - Direct Join (All 1,250 matching rows joined before LIMIT 20)",
    `SELECT uli.*, ct.title, ct.poster_path 
     FROM user_library_items uli 
     JOIN catalog_titles ct ON uli.title_key = ct.title_key 
     WHERE uli.user_id = '${userId}' AND uli.status = 'watching' 
     ORDER BY uli.last_watched_at DESC NULLS LAST 
     LIMIT 20;`
  );

  await runExplain(
    "1B. Continue Watching - Early LIMIT Subquery (Only Top 20 rows joined to Catalog)",
    `SELECT uli.*, ct.title, ct.poster_path 
     FROM (
       SELECT * FROM user_library_items 
       WHERE user_id = '${userId}' AND status = 'watching' 
       ORDER BY last_watched_at DESC NULLS LAST 
       LIMIT 20
     ) uli 
     JOIN catalog_titles ct ON uli.title_key = ct.title_key;`
  );

  // Part 2: TV Series Progress View Diagnostics
  console.log("=== PART 2: TV SERIES PROGRESS VIEW DIAGNOSTICS ===\n");

  await runExplain(
    "2A. Series Progress View - Unscoped Bulk Query (50 items)",
    `SELECT * 
     FROM user_series_progress_view 
     WHERE user_id = '${userId}' 
     LIMIT 50;`
  );

  await runExplain(
    "2B. Series Progress View - Single Title Scoped Query (tmdb_tv_2501)",
    `SELECT * 
     FROM user_series_progress_view 
     WHERE user_id = '${userId}' AND title_key = '${sampleTitleKey}';`
  );

  await runExplain(
    "2C. Series Progress - Replaced COUNT(DISTINCT) with COUNT() (PK guarantees uniqueness)",
    `SELECT ues.user_id, ues.title_key, COUNT(ues.episode_number)::INT AS watched_episodes_count, ct.number_of_episodes AS total_episodes_count, CASE WHEN ct.number_of_episodes > 0 THEN ROUND((COUNT(ues.episode_number)::NUMERIC / ct.number_of_episodes::NUMERIC), 4) ELSE 0.0000 END AS completion_ratio, MAX(ues.season_number) AS last_watched_season, MAX(ues.watched_at) AS last_watched_at FROM user_episode_states ues JOIN catalog_titles ct ON ues.title_key = ct.title_key WHERE ues.user_id = '${userId}' GROUP BY ues.user_id, ues.title_key, ct.number_of_episodes LIMIT 50;`
  );

  await runExplain(
    "2D. Series Progress - Decoupled View (Episode count aggregate without inner Catalog Join)",
    `SELECT ues.user_id, ues.title_key, COUNT(ues.episode_number)::INT AS watched_episodes_count, MAX(ues.season_number) AS last_watched_season, MAX(ues.watched_at) AS last_watched_at FROM user_episode_states ues WHERE ues.user_id = '${userId}' GROUP BY ues.user_id, ues.title_key LIMIT 50;`
  );

  console.log("==================================================");
  console.log("DIAGNOSTIC INVESTIGATION COMPLETE ✅");
  console.log("==================================================");

  await prisma.$disconnect();
}

main();
