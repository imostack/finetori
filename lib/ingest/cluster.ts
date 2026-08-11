import "server-only";

import { and, desc, eq, gte, inArray, isNull, lte, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { clusters, ingestedItems, sources } from "@/db/schema";
import { normalizeTitle } from "./fetch";

/**
 * Words that appear in almost every Nigerian headline and therefore carry no
 * signal when deciding whether two headlines describe the same event.
 */
const STOPWORDS = new Set([
  // Grammatical filler.
  "a", "an", "the", "of", "in", "on", "at", "to", "for", "and", "or", "but",
  "is", "are", "was", "were", "be", "been", "as", "by", "with", "from",
  "that", "this", "it", "its", "his", "her", "their", "we", "you", "they",
  "will", "has", "have", "had", "not", "no", "after", "over", "into", "up",
  "out", "says", "say", "said", "new", "amid", "how", "why", "what", "who",
  "nigeria", "nigerian", "nigerians",

  // Generic newsroom vocabulary. These appear in a large share of Nigerian
  // headlines and match across genuinely unrelated events — "troops … recover
  // … weapons" describes an arrest in Enugu and an ISWAP raid in Borno
  // equally well. Removing them is what lets the threshold come down far
  // enough to catch real matches without pulling in noise.
  "troops", "soldiers", "army", "military", "police", "officers", "operative",
  "arrest", "arrests", "arrested", "recover", "recovers", "recovered",
  "weapons", "killed", "dead", "death", "attack", "suspects", "suspect",
  "man", "men", "woman", "women", "boy", "girl", "people", "residents",
  "group", "report", "reports", "confirms", "reveals", "warns", "urges",
  "million", "billion", "trillion", "naira", "video", "photo", "photos",
  "pictorial", "just", "breaking", "latest", "full", "list", "top",
]);

/**
 * Two headlines must share at least this many significant tokens before their
 * similarity score is trusted. Guards against short titles scoring highly on
 * a single coincidental word.
 */
const MIN_SHARED_TOKENS = 2;

function tokenize(title: string): Set<string> {
  return new Set(
    normalizeTitle(title)
      .split(" ")
      .filter((word) => word.length > 2 && !STOPWORDS.has(word)),
  );
}

/**
 * Jaccard similarity over significant title tokens.
 *
 * Deliberately simple: at a few hundred items per run this is fast, has no
 * external dependency, and is easy to reason about when a cluster looks
 * wrong. If precision becomes a problem, swap in pgvector embeddings here —
 * nothing else in the pipeline needs to change.
 */
export function titleSimilarity(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  let intersection = 0;
  for (const token of tokensA) if (tokensB.has(token)) intersection++;

  if (intersection < MIN_SHARED_TOKENS) return 0;

  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Calibrated against a real 181-item sample across 8 Nigerian outlets.
 *
 * At the original 0.42 every cross-outlet pair scoring 0.25-0.42 was a true
 * match that was being missed — the same Enugu arrest, the same EU statement,
 * the same NERC action, each split into separate single-source clusters,
 * which destroyed the corroboration signal that scoring depends on. Below
 * ~0.20 genuine false positives start appearing.
 *
 * Re-check with `scripts/threshold-check.ts` if the source mix changes
 * substantially.
 */
const SIMILARITY_THRESHOLD = 0.25;
const CLUSTER_WINDOW_HOURS = 24;

type ClusterableItem = {
  id: string;
  title: string;
  sourceId: string;
  publishedAt: Date | null;
  createdAt: Date;
};

/**
 * Groups unclustered items from the last 24h into events, then scores each
 * cluster.
 *
 * Scoring rewards corroboration and freshness:
 *   score = distinctSources * avgTrustWeight * recencyDecay
 *
 * A story five outlets are running right now outranks a single-outlet piece
 * from yesterday, which is what "trending" actually means.
 */
export async function clusterRecentItems(): Promise<{
  clustersCreated: number;
  itemsClustered: number;
}> {
  const cutoff = new Date(Date.now() - CLUSTER_WINDOW_HOURS * 60 * 60 * 1000);

  const pending = (await db
    .select({
      id: ingestedItems.id,
      title: ingestedItems.title,
      sourceId: ingestedItems.sourceId,
      publishedAt: ingestedItems.publishedAt,
      createdAt: ingestedItems.createdAt,
    })
    .from(ingestedItems)
    .where(
      and(
        eq(ingestedItems.status, "new"),
        isNull(ingestedItems.clusterId),
        gte(ingestedItems.createdAt, cutoff),
      ),
    )) as ClusterableItem[];

  if (pending.length === 0) return { clustersCreated: 0, itemsClustered: 0 };

  // Existing open clusters from the same window. Without this step a story
  // that Punch runs at 10:00 and Vanguard picks up at 11:00 becomes two
  // separate single-source clusters, because the 10:00 item is no longer
  // "new" on the 11:00 pass — which collapses the corroboration signal that
  // scoring depends on.
  const openClusters = await db
    .select({
      id: clusters.id,
      representativeTitle: clusters.representativeTitle,
    })
    .from(clusters)
    .where(and(eq(clusters.status, "open"), gte(clusters.lastSeenAt, cutoff)));

  const joins = new Map<string, ClusterableItem[]>();
  const unmatched: ClusterableItem[] = [];

  for (const item of pending) {
    const existing = openClusters.find(
      (c) =>
        titleSimilarity(c.representativeTitle, item.title) >=
        SIMILARITY_THRESHOLD,
    );
    if (existing) {
      const bucket = joins.get(existing.id);
      if (bucket) bucket.push(item);
      else joins.set(existing.id, [item]);
    } else {
      unmatched.push(item);
    }
  }

  // Greedy single-pass grouping over whatever did not join an existing
  // cluster: each item joins the first group it is similar enough to,
  // otherwise it starts a new one.
  const groups: ClusterableItem[][] = [];
  for (const item of unmatched) {
    const match = groups.find((group) =>
      group.some((member) => titleSimilarity(member.title, item.title) >= SIMILARITY_THRESHOLD),
    );
    if (match) match.push(item);
    else groups.push([item]);
  }

  const trustBySource = new Map(
    (await db
      .select({ id: sources.id, trustWeight: sources.trustWeight })
      .from(sources)).map((s) => [s.id, s.trustWeight]),
  );

  // Build every cluster row up front, then write them in as few round-trips
  // as possible. Doing an insert + an update per group meant 2N sequential
  // round-trips to a remote database — slow, and long enough on a big first
  // run for the connection to be reaped mid-loop.
  const rows = groups.map((group) => {
    const distinctSources = new Set(group.map((i) => i.sourceId));
    const avgTrust =
      [...distinctSources].reduce(
        (sum, id) => sum + (trustBySource.get(id) ?? 1),
        0,
      ) / distinctSources.size;

    const timestamps = group.map((i) =>
      (i.publishedAt ?? i.createdAt).getTime(),
    );
    const newest = Math.max(...timestamps);
    const ageHours = (Date.now() - newest) / (1000 * 60 * 60);
    const recencyDecay = Math.exp(-ageHours / 12); // half-life ~8h

    // The longest headline in the group is usually the most descriptive.
    const representativeTitle = group
      .map((i) => i.title)
      .reduce((longest, title) =>
        title.length > longest.length ? title : longest,
      );

    return {
      values: {
        representativeTitle,
        score: distinctSources.size * avgTrust * recencyDecay,
        itemCount: group.length,
        firstSeenAt: new Date(Math.min(...timestamps)),
        lastSeenAt: new Date(newest),
      },
      itemIds: group.map((i) => i.id),
    };
  });

  // One insert for all new clusters. `returning` preserves input order, so
  // the Nth id belongs to the Nth group.
  const inserted =
    rows.length > 0
      ? await db
          .insert(clusters)
          .values(rows.map((r) => r.values))
          .returning({ id: clusters.id })
      : [];

  // One UPDATE per cluster is unavoidable (each sets a different clusterId),
  // but they are independent — issue them concurrently rather than serially.
  await Promise.all([
    ...inserted.map((cluster, index) =>
      db
        .update(ingestedItems)
        .set({ clusterId: cluster.id, status: "clustered" })
        .where(inArray(ingestedItems.id, rows[index].itemIds)),
    ),
    // Late arrivals joining a cluster from an earlier run: attach the items,
    // then bump the cluster's item count and freshness so its score reflects
    // the extra corroboration on the next ranking pass.
    ...[...joins.entries()].flatMap(([clusterId, items]) => [
      db
        .update(ingestedItems)
        .set({ clusterId, status: "clustered" })
        .where(
          inArray(
            ingestedItems.id,
            items.map((i) => i.id),
          ),
        ),
      db
        .update(clusters)
        .set({
          itemCount: sql`${clusters.itemCount} + ${items.length}`,
          score: sql`${clusters.score} + ${items.length}`,
          lastSeenAt: new Date(
            Math.max(
              ...items.map((i) => (i.publishedAt ?? i.createdAt).getTime()),
            ),
          ),
        })
        .where(eq(clusters.id, clusterId)),
    ]),
  ]);

  const joinedCount = [...joins.values()].reduce((n, i) => n + i.length, 0);

  return {
    clustersCreated: inserted.length,
    itemsClustered:
      rows.reduce((sum, r) => sum + r.itemIds.length, 0) + joinedCount,
  };
}

export type ClusterWithItems = {
  id: string;
  representativeTitle: string;
  score: number;
  itemCount: number;
  items: {
    title: string;
    summary: string | null;
    url: string;
    imageUrl: string | null;
    publishedAt: Date | null;
    sourceName: string;
  }[];
};

/** Highest-scoring open clusters, with their source material attached. */
export async function getTopOpenClusters(
  limit: number,
): Promise<ClusterWithItems[]> {
  const ranked = await db
    .select({
      id: clusters.id,
      representativeTitle: clusters.representativeTitle,
      score: clusters.score,
      itemCount: clusters.itemCount,
    })
    .from(clusters)
    .where(eq(clusters.status, "open"))
    .orderBy(desc(clusters.score))
    .limit(limit);

  if (ranked.length === 0) return [];

  const items = await db
    .select({
      clusterId: ingestedItems.clusterId,
      title: ingestedItems.title,
      summary: ingestedItems.summary,
      url: ingestedItems.url,
      imageUrl: ingestedItems.imageUrl,
      publishedAt: ingestedItems.publishedAt,
      sourceName: sources.name,
    })
    .from(ingestedItems)
    .innerJoin(sources, eq(ingestedItems.sourceId, sources.id))
    .where(
      inArray(
        ingestedItems.clusterId,
        ranked.map((c) => c.id),
      ),
    );

  return ranked.map((cluster) => ({
    ...cluster,
    items: items
      .filter((i) => i.clusterId === cluster.id)
      .map(({ clusterId, ...rest }) => {
        void clusterId;
        return rest;
      }),
  }));
}

/** Drops clusters older than a week so the table does not grow unbounded. */
export async function pruneStaleClusters(): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const stale = await db
    .select({ id: clusters.id })
    .from(clusters)
    .where(
      and(
        or(eq(clusters.status, "open"), eq(clusters.status, "failed")),
        lte(clusters.lastSeenAt, cutoff),
      ),
    );

  if (stale.length === 0) return 0;

  await db
    .update(clusters)
    .set({ status: "rejected", failureReason: "expired without publication" })
    .where(
      inArray(
        clusters.id,
        stale.map((c) => c.id),
      ),
    );

  return stale.length;
}
