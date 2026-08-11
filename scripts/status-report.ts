/** Counts articles by status, and whether they have what publishing requires. */
import { sql as raw } from "drizzle-orm";

import { db, sql as conn } from "@/db";
import { articles } from "@/db/schema";

async function main() {
  const rows = await db
    .select({
      status: articles.status,
      total: raw<number>`count(*)::int`,
      withCover: raw<number>`count(${articles.coverImageUrl})::int`,
      withAuthor: raw<number>`count(${articles.authorId})::int`,
      withCategory: raw<number>`count(${articles.categoryId})::int`,
    })
    .from(articles)
    .groupBy(articles.status);

  if (rows.length === 0) {
    console.log("No articles in the database at all.");
    return;
  }

  console.log("status        total  cover  byline  section");
  console.log("-----------   -----  -----  ------  -------");
  for (const r of rows) {
    console.log(
      String(r.status).padEnd(13),
      String(r.total).padStart(5),
      String(r.withCover).padStart(6),
      String(r.withAuthor).padStart(7),
      String(r.withCategory).padStart(8),
    );
  }

  console.log(
    "\nPublishing requires all three of cover, byline and section.",
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await conn.end();
  });
