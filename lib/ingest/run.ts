import "server-only";

import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import {
  articles,
  articleTags,
  categories,
  clusters,
  ingestedItems,
  tags,
} from "@/db/schema";
import { sanitizeArticleHtml, sanitizePlainText } from "@/lib/sanitize";
import { plainExcerpt, slugify, slugWithSuffix } from "@/lib/utils";
import { clusterRecentItems, getTopOpenClusters, pruneStaleClusters } from "./cluster";
import { fetchAndStoreItems } from "./fetch";
import { generateArticle } from "./generate";

export type IngestReport = {
  startedAt: string;
  durationMs: number;
  sources: number;
  itemsFetched: number;
  itemsNew: number;
  clustersCreated: number;
  clustersPruned: number;
  draftsCreated: number;
  failures: { cluster: string; reason: string }[];
  usage: {
    inputTokens: number;
    outputTokens: number;
    cacheReadTokens: number;
    cacheCreationTokens: number;
  };
};

/**
 * Reserves a unique slug. Falls back to a date suffix, then a counter, so two
 * stories about the same subject on the same day cannot collide on the unique
 * index and abort the run.
 */
async function reserveSlug(title: string): Promise<string> {
  const base = slugify(title) || "story";

  const candidates = [
    base,
    slugWithSuffix(base, new Date().toISOString().slice(0, 10)),
  ];
  for (let i = 2; i <= 6; i++) candidates.push(slugWithSuffix(base, i));

  const taken = new Set(
    (
      await db
        .select({ slug: articles.slug })
        .from(articles)
        .where(inArray(articles.slug, candidates))
    ).map((r) => r.slug),
  );

  const free = candidates.find((c) => !taken.has(c));
  // Exhausting six candidates is vanishingly unlikely; a timestamp guarantees
  // uniqueness rather than failing the insert.
  return free ?? slugWithSuffix(base, Date.now());
}

/** Finds or creates tag rows and links them to the article. */
async function attachTags(articleId: string, names: string[]): Promise<void> {
  const cleaned = [
    ...new Set(
      names
        .map((n) => sanitizePlainText(n).toLowerCase().trim())
        .filter((n) => n.length > 1 && n.length <= 60),
    ),
  ].slice(0, 5);

  if (cleaned.length === 0) return;

  for (const name of cleaned) {
    const slug = slugify(name);
    if (!slug) continue;

    const [existing] = await db
      .select({ id: tags.id })
      .from(tags)
      .where(eq(tags.slug, slug))
      .limit(1);

    const tagId =
      existing?.id ??
      (
        await db
          .insert(tags)
          .values({ slug, name })
          .onConflictDoNothing()
          .returning({ id: tags.id })
      )[0]?.id ??
      (
        await db
          .select({ id: tags.id })
          .from(tags)
          .where(eq(tags.slug, slug))
          .limit(1)
      )[0]?.id;

    if (tagId) {
      await db
        .insert(articleTags)
        .values({ articleId, tagId })
        .onConflictDoNothing();
    }
  }
}

/**
 * One full ingestion cycle: fetch feeds, cluster, generate drafts, queue them
 * for review. Never publishes anything — every draft lands in `in_review`.
 */
export async function runIngestion(
  maxDrafts = Number(process.env.INGEST_MAX_DRAFTS_PER_RUN) || 10,
): Promise<IngestReport> {
  const startedAt = new Date();
  const failures: IngestReport["failures"] = [];
  const usage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
  };

  /* 1 & 2 — fetch, normalize, dedupe */
  const fetchResult = await fetchAndStoreItems();

  /* 3 & 4 — cluster and score */
  const clusterResult = await clusterRecentItems();
  const clustersPruned = await pruneStaleClusters();

  /* 5 — generate */
  const categoryRows = await db
    .select({ slug: categories.slug })
    .from(categories);
  const categorySlugs = categoryRows.map((c) => c.slug);
  const validSlugs = new Set(categorySlugs);

  const candidates = await getTopOpenClusters(maxDrafts);
  let draftsCreated = 0;

  for (const cluster of candidates) {
    const result = await generateArticle(cluster, categorySlugs);

    if (!result.ok) {
      failures.push({ cluster: cluster.representativeTitle, reason: result.reason });
      await db
        .update(clusters)
        .set({
          // A refusal is a permanent decision for this material; a transient
          // API error should be retried on the next run.
          status: result.refusal ? "rejected" : "failed",
          failureReason: result.reason.slice(0, 500),
        })
        .where(eq(clusters.id, cluster.id));
      continue;
    }

    usage.inputTokens += result.usage.inputTokens;
    usage.outputTokens += result.usage.outputTokens;
    usage.cacheReadTokens += result.usage.cacheReadTokens;
    usage.cacheCreationTokens += result.usage.cacheCreationTokens;

    const generated = result.article;

    // Trust nothing from the model that lands in the database.
    const headline = sanitizePlainText(generated.headline).slice(0, 300);
    const body = sanitizeArticleHtml(generated.body);
    if (!headline || !body) {
      failures.push({
        cluster: cluster.representativeTitle,
        reason: "Sanitisation left no usable headline or body.",
      });
      await db
        .update(clusters)
        .set({ status: "failed", failureReason: "empty after sanitisation" })
        .where(eq(clusters.id, cluster.id));
      continue;
    }

    const slugValue = validSlugs.has(generated.categorySlug)
      ? generated.categorySlug
      : "news";
    const [category] = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, slugValue))
      .limit(1);

    // Only keep source URLs that actually came from this cluster — stops a
    // hallucinated link reaching the attribution block.
    const clusterUrls = new Map(
      cluster.items.map((i) => [i.url, i.sourceName]),
    );
    const attribution = generated.sources
      .filter((s) => clusterUrls.has(s.url))
      .map((s) => ({ name: clusterUrls.get(s.url)!, url: s.url }));
    const sourceAttribution =
      attribution.length > 0
        ? attribution
        : cluster.items.map((i) => ({ name: i.sourceName, url: i.url }));

    const [inserted] = await db
      .insert(articles)
      .values({
        slug: await reserveSlug(headline),
        title: headline,
        dek: sanitizePlainText(generated.dek).slice(0, 400) || null,
        body,
        excerpt:
          sanitizePlainText(generated.excerpt).slice(0, 400) ||
          plainExcerpt(body, 200),
        categoryId: category?.id ?? null,
        // No author until an editor claims it at approval time.
        authorId: null,
        // Never auto-publish. This is the approval gate.
        status: "in_review",
        seoTitle: sanitizePlainText(generated.seoTitle).slice(0, 70) || null,
        seoDescription:
          sanitizePlainText(generated.seoDescription).slice(0, 200) || null,
        aiGenerated: true,
        aiModel: process.env.ANTHROPIC_MODEL || "claude-opus-5",
        sourceAttribution,
        clusterId: cluster.id,
      })
      .returning({ id: articles.id });

    await attachTags(inserted.id, generated.tags ?? []);

    await db
      .update(clusters)
      .set({ status: "drafted" })
      .where(eq(clusters.id, cluster.id));
    await db
      .update(ingestedItems)
      .set({ status: "drafted" })
      .where(eq(ingestedItems.clusterId, cluster.id));

    draftsCreated++;
  }

  return {
    startedAt: startedAt.toISOString(),
    durationMs: Date.now() - startedAt.getTime(),
    sources: fetchResult.sourceCount,
    itemsFetched: fetchResult.fetched,
    itemsNew: fetchResult.inserted,
    clustersCreated: clusterResult.clustersCreated,
    clustersPruned,
    draftsCreated,
    failures,
    usage,
  };
}
