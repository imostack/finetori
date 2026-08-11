/**
 * Diagnostic, two modes:
 *
 *   reset   — wipe clustering state so the next ingest run re-clusters
 *             everything already fetched (does not touch feeds or articles)
 *   report  — show how well items grouped
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/recluster-test.ts reset
 *   curl -X POST ".../api/cron/ingest?max=0" -H "Authorization: Bearer $CRON_SECRET"
 *   npx tsx --env-file=.env.local scripts/recluster-test.ts report
 *
 * Imports only the schema, never lib/ingest — those modules are `server-only`
 * and refuse to load outside Next.
 */
import { desc, sql } from "drizzle-orm";

import { db, sql as conn } from "@/db";
import { articles, clusters, ingestedItems } from "@/db/schema";

async function reset() {
  await db
    .update(articles)
    .set({ clusterId: null })
    .where(sql`${articles.clusterId} is not null`);
  await db.update(ingestedItems).set({ clusterId: null, status: "new" });
  const deleted = await db.delete(clusters).returning({ id: clusters.id });
  console.log(
    `cleared ${deleted.length} clusters; all items reset to "new".\n` +
      `Now trigger an ingest run to re-cluster.`,
  );
}

async function report() {
  const [totals] = await db
    .select({
      n: sql<number>`count(*)::int`,
      items: sql<number>`coalesce(sum(${clusters.itemCount}), 0)::int`,
      multi: sql<number>`count(*) filter (where ${clusters.itemCount} > 1)::int`,
      biggest: sql<number>`coalesce(max(${clusters.itemCount}), 0)::int`,
    })
    .from(clusters);

  console.log(`clusters          : ${totals.n}`);
  console.log(`items clustered   : ${totals.items}`);
  console.log(`multi-source      : ${totals.multi}`);
  console.log(
    `avg items/cluster : ${(totals.items / Math.max(1, totals.n)).toFixed(2)}`,
  );
  console.log(`largest cluster   : ${totals.biggest} items\n`);

  const rows = await db
    .select({
      title: clusters.representativeTitle,
      itemCount: clusters.itemCount,
      score: clusters.score,
    })
    .from(clusters)
    .orderBy(desc(clusters.itemCount), desc(clusters.score))
    .limit(8);

  console.log("largest clusters:");
  for (const r of rows) {
    console.log(
      `  ${String(r.itemCount).padStart(2)}x  score ${r.score.toFixed(2).padStart(6)}  ${r.title.slice(0, 60)}`,
    );
  }
}

const mode = process.argv[2] ?? "report";

(mode === "reset" ? reset() : report())
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await conn.end();
  });
