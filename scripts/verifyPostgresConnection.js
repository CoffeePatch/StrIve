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
  console.log("Testing PostgreSQL database connection via Prisma...");

  try {
    const result = await prisma.$queryRaw`SELECT current_database(), version()`;
    console.log("✅ Successfully connected to local PostgreSQL database!");
    console.log("Database Info:", result);
  } catch (error) {
    console.error("❌ Failed to connect to PostgreSQL database:");
    console.error(error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
