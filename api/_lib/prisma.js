import { PrismaClient } from "@prisma/client";

// Global singleton pattern to prevent exhausting database connection pools
// during serverless execution and hot-reloading in development.
const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
