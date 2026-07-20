import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../db/schema";
import { getServerEnv } from "./env.server";

const globalForDatabase = globalThis as typeof globalThis & {
  resumeMakerPool?: Pool;
};

export function getPool(): Pool {
  if (!globalForDatabase.resumeMakerPool) {
    globalForDatabase.resumeMakerPool = new Pool({
      connectionString: getServerEnv().DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl:
        getServerEnv().DATABASE_URL.includes("localhost") ||
        getServerEnv().DATABASE_URL.includes("127.0.0.1")
          ? undefined
          : { rejectUnauthorized: true },
    });
  }

  return globalForDatabase.resumeMakerPool;
}

export const db = drizzle(getPool(), { schema });
export type Database = typeof db;
