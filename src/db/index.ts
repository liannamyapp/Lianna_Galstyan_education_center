import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
import * as schema from "./schema";

const g = globalThis as unknown as { __pool?: Pool; __db?: NodePgDatabase<typeof schema> };

/** Network hiccups worth one more try: Neon waking up, a stale pooled socket, a dropped TLS handshake. */
const TRANSIENT = ["ECONNRESET", "ETIMEDOUT", "EPIPE", "ECONNREFUSED", "08P01", "08006", "08003", "57P01"];
const isTransient = (e: unknown) => {
  const err = e as { code?: string; message?: string };
  return TRANSIENT.includes(err?.code ?? "") || /Connection terminated|timed out|socket disconnected|Authentication timed out/i.test(err?.message ?? "");
};

/** Pool whose single queries are retried once after a transient connection error (never inside a transaction). */
class RetryPool extends Pool {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override query(...args: any[]): any {
    const cb = typeof args[args.length - 1] === "function";
    if (cb) return (super.query as (...a: unknown[]) => unknown)(...args);
    return (super.query as (...a: unknown[]) => Promise<unknown>)(...args).catch(async (e: unknown) => {
      if (!isTransient(e)) throw e;
      await new Promise((r) => setTimeout(r, 300));
      return (super.query as (...a: unknown[]) => Promise<unknown>)(...args);
    });
  }
}

function make() {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error("DATABASE_URL is not set");
  // sslmode in the URL makes pg print a deprecation warning on every cold start; TLS is configured explicitly instead
  const needsTls = /sslmode=(require|verify-full|verify-ca|prefer)/.test(raw);
  let url = raw;
  try { const u = new URL(raw); u.searchParams.delete("sslmode"); u.searchParams.delete("channel_binding"); url = u.toString(); } catch { /* keep as is */ }
  const cfg: PoolConfig = {
    connectionString: url,
    max: 5,
    ssl: needsTls ? { rejectUnauthorized: true } : undefined,
    connectionTimeoutMillis: 15_000, // Neon may need a few seconds to wake up
    idleTimeoutMillis: 20_000,       // drop idle sockets before the pooler does
    keepAlive: true,
  };
  const pool = new RetryPool(cfg);
  pool.on("error", (e) => console.error("[db] idle client error:", e.message)); // never crash on a dropped idle socket
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
