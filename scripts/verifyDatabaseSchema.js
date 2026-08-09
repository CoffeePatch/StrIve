import fs from "node:fs";
import dotenv from "dotenv";

if (fs.existsSync(".env.local")) {
  dotenv.config({ path: ".env.local" });
} else {
  dotenv.config();
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("==================================================");
  console.log("Phase 3.2 Database Schema Verification Report");
  console.log("==================================================\n");

  // 1. Verify Public Tables
  const tables = await prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name != '_prisma_migrations'
    ORDER BY table_name;
  `;

  console.log(`📋 BASE TABLES (${tables.length} Detected):`);
  tables.forEach((t) => console.log(`  - ${t.table_name}`));
  console.log("");

  // 2. Verify Public Views
  const views = await prisma.$queryRaw`
    SELECT table_name 
    FROM information_schema.views 
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `;

  console.log(`👁️ SQL VIEWS (${views.length} Detected):`);
  views.forEach((v) => console.log(`  - ${v.table_name}`));
  console.log("");

  // 3. Verify Foreign Keys
  const fks = await prisma.$queryRaw`
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema='public'
    ORDER BY tc.table_name, kcu.column_name;
  `;

  console.log(`🔗 FOREIGN KEYS (${fks.length} Detected):`);
  fks.forEach((fk) =>
    console.log(
      `  - ${fk.table_name}.${fk.column_name} -> ${fk.foreign_table_name}.${fk.foreign_column_name}`
    )
  );
  console.log("");

  // 4. Verify Primary Keys
  const pks = await prisma.$queryRaw`
    SELECT 
      tc.table_name, 
      string_agg(kcu.column_name, ', ') AS primary_keys
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public' AND tc.table_name != '_prisma_migrations'
    GROUP BY tc.table_name
    ORDER BY tc.table_name;
  `;

  console.log(`🔑 PRIMARY KEYS (${pks.length} Detected):`);
  pks.forEach((pk) => console.log(`  - ${pk.table_name}: (${pk.primary_keys})`));
  console.log("");

  // Summary Verdict
  const expectedTables = 8;
  const expectedViews = 1;
  const passed = tables.length === expectedTables && views.length === expectedViews;

  console.log("==================================================");
  console.log(`VERIFICATION RESULT: ${passed ? "PASS ✅" : "FAIL ❌"}`);
  console.log(`- Base Tables: ${tables.length}/${expectedTables}`);
  console.log(`- Views: ${views.length}/${expectedViews}`);
  console.log("==================================================");

  await prisma.$disconnect();
  if (!passed) process.exit(1);
}

main();
