import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const g = globalThis as unknown as { __pool?: Pool; __db?: NodePgDatabase<typeof schema> };

function make() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new Pool({
    connectionString: url,
    max: 5,
    ssl: /sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined,
  });
  return { pool, db: drizzle(pool, { schema }) };
}

export function getDb() {
  if (!g.__db) {
    const { pool, db } = make();
    g.__pool = pool;
    g.__db = db;
  }
  return g.__db!;
}

export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_t, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    const v = real[prop];
    return typeof v === "function" ? (v as (...a: unknown[]) => unknown).bind(real) : v;
  },
});

export * as s from "./schema";
