/** Per-source ingestion health. Handy after a cron run. */
import { count, desc, eq } from "drizzle-orm";

import { db, sql } from "@/db";
import { articles, clusters, ingestedItems, sources } from "@/db/schema";

async function main() {
  const rows = await db
    .select({
      name: sources.name,
      enabled: sources.enabled,
      items: count(ingestedItems.id),
      lastError: sources.lastError,
    })
    .from(sources)
    .leftJoin(ingestedItems, eq(ingestedItems.sourceId, sources.id))
    .groupBy(sources.id)
    .orderBy(desc(count(ingestedItems.id)));

  console.log("items  source");
  console.log("-----  ------------------------------------------");
  for (const r of rows) {
    const flag = r.enabled ? " " : "x";
    console.log(
      `${String(r.items).padStart(5)}${flag} ${r.name}${
        r.lastError ? `\n         └─ ${r.lastError.slice(0, 70)}` : ""
      }`,
    );
  }

  const [[items], [cl], [art]] = await Promise.all([
    db.select({ v: count() }).from(ingestedItems),
    db.select({ v: count() }).from(clusters),
    db.select({ v: count() }).from(articles),
  ]);

  console.log(
    `\ntotals: ${items.v} items · ${cl.v} clusters · ${art.v} articles`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
