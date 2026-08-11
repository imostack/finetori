import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Database = PostgresJsDatabase<typeof schema>;
type Client = ReturnType<typeof postgres>;

// Serverless functions get a fresh module scope per cold start but can be
// reused across invocations, so cache the client on globalThis to avoid
// opening a new pool on every hot invocation (and on every HMR reload in dev).
const globalForDb = globalThis as unknown as { __finetoriSql?: Client };

let cached: { sql: Client; db: Database } | null = null;

function connect() {
  if (cached) return cached;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      [
        "DATABASE_URL is not set.",
        "  Local development: copy .env.example to .env.local and fill it in.",
        "  Deployed host: add DATABASE_URL to the project's environment variables",
        "  and redeploy. The build prerenders /sitemap.xml, /rss.xml and",
        "  /news-sitemap.xml, so the database must be reachable at build time —",
        "  not only at runtime.",
      ].join("\n"),
    );
  }

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

  cached = { sql, db: drizzle(sql, { schema }) };
  return cached;
}

/**
 * Defers construction to first property access.
 *
 * Connecting at module scope meant a missing DATABASE_URL threw while Next.js
 * was merely *evaluating* the module graph, which it reports as "Failed to
 * collect configuration for /sitemap.xml" with the real cause buried several
 * frames down. Deferring puts the error at the query that actually needs the
 * database, where the message is legible.
 *
 * Methods are bound to the real target — returning them unbound would leave
 * `this` pointing at the proxy and break Drizzle's builder chain.
 */
function lazy<T extends object>(resolve: () => T): T {
  return new Proxy({} as T, {
    get(_target, property) {
      const target = resolve();
      const value = Reflect.get(target, property) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

export const db = lazy<Database>(() => connect().db);
export const sql = lazy<Client>(() => connect().sql);
export { schema };
