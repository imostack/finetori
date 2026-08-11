import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.",
  );
}

// Serverless functions get a fresh module scope per cold start but can be
// reused across invocations, so cache the client on globalThis to avoid
// opening a new pool on every hot invocation (and on every HMR reload in dev).
const globalForDb = globalThis as unknown as {
  __finetoriSql?: ReturnType<typeof postgres>;
};

const sql =
  globalForDb.__finetoriSql ??
  postgres(connectionString, {
    // Neon's pooler fronts the real pool; keep per-instance connections low.
    max: 1,
    // Generous enough that a long job (the ingestion cron spends ~45s fetching
    // feeds before it writes anything) does not have its connection reaped
    // between phases and fail on the next query.
    idle_timeout: 120,
    connect_timeout: 15,
    max_lifetime: 60 * 30,
    prepare: false, // required when going through a transaction pooler
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__finetoriSql = sql;
}

export const db = drizzle(sql, { schema });
export { schema, sql };
