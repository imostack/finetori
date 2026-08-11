/**
 * Calibration check for the clustering threshold.
 *
 * Lists title pairs that scored just below SIMILARITY_THRESHOLD. If those
 * near-misses are genuinely the same story, the threshold is too strict; if
 * they are unrelated, it is about right.
 *
 * Reimplements the similarity function rather than importing it, because
 * lib/ingest/cluster.ts is `server-only`.
 */
import { db, sql as conn } from "@/db";
import { ingestedItems, sources } from "@/db/schema";
import { eq } from "drizzle-orm";

const STOPWORDS = new Set([
  "a","an","the","of","in","on","at","to","for","and","or","but","is","are",
  "was","were","be","been","as","by","with","from","that","this","it","its",
  "his","her","their","we","you","they","will","has","have","had","not","no",
  "after","over","into","up","out","says","say","said","new","amid","how",
  "why","what","who","nigeria","nigerian","nigerians",
]);

function tokenize(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[‘’“”]/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .split(" ")
      .filter((w) => w.length > 2 && !STOPWORDS.has(w)),
  );
}

function similarity(a: string, b: string): number {
  const A = tokenize(a);
  const B = tokenize(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

const THRESHOLD = 0.25;
const FLOOR = 0.14;

async function main() {
  const items = await db
    .select({
      title: ingestedItems.title,
      source: sources.name,
    })
    .from(ingestedItems)
    .innerJoin(sources, eq(ingestedItems.sourceId, sources.id));

  console.log(`${items.length} items, comparing all pairs…\n`);

  const nearMisses: { a: string; b: string; s: number; sa: string; sb: string }[] =
    [];

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      // Only cross-outlet pairs matter — one outlet rarely runs the same
      // story twice, and self-matches are not corroboration.
      if (items[i].source === items[j].source) continue;
      const s = similarity(items[i].title, items[j].title);
      if (s >= FLOOR && s < THRESHOLD) {
        nearMisses.push({
          a: items[i].title,
          b: items[j].title,
          s,
          sa: items[i].source,
          sb: items[j].source,
        });
      }
    }
  }

  nearMisses.sort((x, y) => y.s - x.s);

  console.log(
    `${nearMisses.length} cross-outlet pairs scored ${FLOOR}-${THRESHOLD} (just below the cut):\n`,
  );
  for (const m of nearMisses.slice(0, 15)) {
    console.log(`  ${m.s.toFixed(3)}`);
    console.log(`    [${m.sa}] ${m.a.slice(0, 68)}`);
    console.log(`    [${m.sb}] ${m.b.slice(0, 68)}\n`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await conn.end();
  });
