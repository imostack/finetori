/** Prints the most recent generated draft for eyeballing. */
import { desc, eq } from "drizzle-orm";

import { db, sql as conn } from "@/db";
import { articles, categories } from "@/db/schema";

async function main() {
  const [row] = await db
    .select({
      title: articles.title,
      slug: articles.slug,
      dek: articles.dek,
      excerpt: articles.excerpt,
      body: articles.body,
      status: articles.status,
      aiGenerated: articles.aiGenerated,
      seoTitle: articles.seoTitle,
      seoDescription: articles.seoDescription,
      sourceAttribution: articles.sourceAttribution,
      category: categories.name,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .orderBy(desc(articles.createdAt))
    .limit(1);

  if (!row) {
    console.log("No articles in the database.");
    return;
  }

  console.log("HEADLINE  ", row.title);
  console.log("SLUG      ", row.slug);
  console.log("DEK       ", row.dek);
  console.log("CATEGORY  ", row.category, "| STATUS", row.status, "| AI", row.aiGenerated);
  console.log("SEO TITLE ", row.seoTitle, `(${row.seoTitle?.length ?? 0} chars)`);
  console.log("SEO DESC  ", row.seoDescription, `(${row.seoDescription?.length ?? 0} chars)`);
  console.log("SOURCES   ", JSON.stringify(row.sourceAttribution, null, 2));
  console.log("\n--- BODY ---\n");
  console.log(row.body);

  const words = (row.body ?? "").replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean);
  console.log(`\n--- ${words.length} words ---`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await conn.end();
  });
