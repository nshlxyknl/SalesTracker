import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function createPrismaClient() {
  if (!process.env.DATABASE_URL) {
    console.warn("DATABASE_URL not found, creating mock client");
    // Return a basic client for build time
    return {} as PrismaClient;
  }

  try {
    const pool = new Pool({ 
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    const adapter = new PrismaPg(pool);

    const shouldLogQueries = process.env.PRISMA_QUERY_LOGGING === "true" && process.env.NODE_ENV === "development";
    
    return new PrismaClient({
      adapter,
      log: shouldLogQueries ? ["query", "error", "warn"] : ["error"],
    });
  } catch (error) {
    console.error("Failed to create Prisma client:", error);
    return {} as PrismaClient;
  }
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
