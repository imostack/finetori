import "server-only";

import { and, desc, eq, gte, inArray, isNotNull, ne, or, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  articles,
  articleTags,
  articleViews,
  categories,
  tags,
  users,
} from "@/db/schema";

/**
 * Shared shape for every article listing (cards, rails, category grids).
 * Deliberately excludes `body` — listings never need it, and pulling article
 * bodies into a 30-item homepage query is the easiest way to make this site
 * slow as the archive grows.
 */
const listingColumns = {
  id: articles.id,
  slug: articles.slug,
  title: articles.title,
  dek: articles.dek,
  excerpt: articles.excerpt,
  coverImageUrl: articles.coverImageUrl,
  publishedAt: articles.publishedAt,
  isBreaking: articles.isBreaking,
  isFeatured: articles.isFeatured,
  categoryName: categories.name,
  categorySlug: categories.slug,
  authorName: users.name,
  authorSlug: users.slug,
};

export type ArticleListing = {
  id: string;
  slug: string;
  title: string;
  dek: string | null;
  excerpt: string | null;
  coverImageUrl: string | null;
  publishedAt: Date | null;
  isBreaking: boolean;
  isFeatured: boolean;
  categoryName: string | null;
  categorySlug: string | null;
  authorName: string | null;
  authorSlug: string | null;
};

/** Only published articles whose publish time has actually arrived. */
const isLive = and(
  eq(articles.status, "published"),
  isNotNull(articles.publishedAt),
  sql`${articles.publishedAt} <= now()`,
);

function baseListingQuery() {
  return db
    .select(listingColumns)
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(users, eq(articles.authorId, users.id));
}

/* ----------------------------------------------------------------- feeds */

export async function getLatestArticles(
  limit = 12,
  offset = 0,
): Promise<ArticleListing[]> {
  return baseListingQuery()
    .where(isLive)
    .orderBy(desc(articles.publishedAt))
    .limit(limit)
    .offset(offset);
}

export async function getFeaturedArticle(): Promise<ArticleListing | null> {
  const [featured] = await baseListingQuery()
    .where(and(isLive, eq(articles.isFeatured, true)))
    .orderBy(desc(articles.publishedAt))
    .limit(1);

  if (featured) return featured;

  // Nothing explicitly featured — fall back to the newest story so the hero
  // slot is never empty.
  const [newest] = await baseListingQuery()
    .where(isLive)
    .orderBy(desc(articles.publishedAt))
    .limit(1);
  return newest ?? null;
}

export async function getBreakingArticle(): Promise<ArticleListing | null> {
  // Breaking status expires on its own after 12 hours so nobody has to
  // remember to switch the banner off.
  const cutoff = new Date(Date.now() - 12 * 60 * 60 * 1000);
  const [row] = await baseListingQuery()
    .where(
      and(isLive, eq(articles.isBreaking, true), gte(articles.publishedAt, cutoff)),
    )
    .orderBy(desc(articles.publishedAt))
    .limit(1);
  return row ?? null;
}

export async function getArticlesByCategory(
  categorySlug: string,
  limit = 12,
  offset = 0,
): Promise<ArticleListing[]> {
  // Include children so /business also surfaces /energy, /money etc.
  const descendants = await getCategoryWithDescendantIds(categorySlug);
  if (descendants.length === 0) return [];

  return baseListingQuery()
    .where(and(isLive, inArray(articles.categoryId, descendants)))
    .orderBy(desc(articles.publishedAt))
    .limit(limit)
    .offset(offset);
}

export async function countArticlesByCategory(
  categorySlug: string,
): Promise<number> {
  const descendants = await getCategoryWithDescendantIds(categorySlug);
  if (descendants.length === 0) return 0;
  const [row] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(articles)
    .where(and(isLive, inArray(articles.categoryId, descendants)));
  return row?.value ?? 0;
}

/* ------------------------------------------------------------- trending */

/**
 * Most-read over the last 48h, weighted so today counts double yesterday.
 * Reads the daily rollup rather than a raw event log.
 */
export async function getTrendingArticles(
  limit = 6,
): Promise<ArticleListing[]> {
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);

  const rows = await db
    .select({
      ...listingColumns,
      score: sql<number>`sum(${articleViews.count} * case when ${articleViews.day} = ${today} then 2 else 1 end)`,
    })
    .from(articleViews)
    .innerJoin(articles, eq(articleViews.articleId, articles.id))
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(users, eq(articles.authorId, users.id))
    .where(and(isLive, gte(articleViews.day, since)))
    .groupBy(
      articles.id,
      articles.slug,
      articles.title,
      articles.dek,
      articles.excerpt,
      articles.coverImageUrl,
      articles.publishedAt,
      articles.isBreaking,
      articles.isFeatured,
      categories.name,
      categories.slug,
      users.name,
      users.slug,
    )
    .orderBy(desc(sql`sum(${articleViews.count})`))
    .limit(limit);

  if (rows.length > 0) return rows;

  // A brand new site has no view data yet; showing recent stories beats
  // showing an empty rail.
  return getLatestArticles(limit);
}

/* -------------------------------------------------------------- article */

export async function getArticleBySlug(slug: string) {
  const [row] = await db
    .select({
      id: articles.id,
      slug: articles.slug,
      title: articles.title,
      dek: articles.dek,
      body: articles.body,
      excerpt: articles.excerpt,
      coverImageUrl: articles.coverImageUrl,
      coverCaption: articles.coverCaption,
      coverCredit: articles.coverCredit,
      publishedAt: articles.publishedAt,
      updatedAt: articles.updatedAt,
      isBreaking: articles.isBreaking,
      seoTitle: articles.seoTitle,
      seoDescription: articles.seoDescription,
      aiGenerated: articles.aiGenerated,
      sourceAttribution: articles.sourceAttribution,
      categoryId: articles.categoryId,
      categoryName: categories.name,
      categorySlug: categories.slug,
      authorId: articles.authorId,
      authorName: users.name,
      authorSlug: users.slug,
      authorBio: users.bio,
      authorAvatarUrl: users.avatarUrl,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(users, eq(articles.authorId, users.id))
    .where(and(eq(articles.slug, slug), isLive))
    .limit(1);

  return row ?? null;
}

export async function getArticleTags(articleId: string) {
  return db
    .select({ name: tags.name, slug: tags.slug })
    .from(articleTags)
    .innerJoin(tags, eq(articleTags.tagId, tags.id))
    .where(eq(articleTags.articleId, articleId));
}

export async function getRelatedArticles(
  articleId: string,
  categoryId: string | null,
  limit = 4,
): Promise<ArticleListing[]> {
  if (!categoryId) return getLatestArticles(limit);

  const rows = await baseListingQuery()
    .where(
      and(isLive, eq(articles.categoryId, categoryId), ne(articles.id, articleId)),
    )
    .orderBy(desc(articles.publishedAt))
    .limit(limit);

  if (rows.length >= limit) return rows;

  // Backfill from the general feed so the rail is always full.
  const fill = await baseListingQuery()
    .where(and(isLive, ne(articles.id, articleId)))
    .orderBy(desc(articles.publishedAt))
    .limit(limit);

  const seen = new Set(rows.map((r) => r.id));
  for (const row of fill) {
    if (rows.length >= limit) break;
    if (!seen.has(row.id)) {
      rows.push(row);
      seen.add(row.id);
    }
  }
  return rows;
}

/* ----------------------------------------------------------- categories */

export async function getTopLevelCategories() {
  return db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      description: categories.description,
    })
    .from(categories)
    .where(sql`${categories.parentId} is null`)
    .orderBy(categories.sortOrder, categories.name);
}

export async function getAllCategories() {
  return db
    .select({
      id: categories.id,
      slug: categories.slug,
      name: categories.name,
      parentId: categories.parentId,
      description: categories.description,
    })
    .from(categories)
    .orderBy(categories.sortOrder, categories.name);
}

export async function getCategoryBySlug(slug: string) {
  const [row] = await db
    .select()
    .from(categories)
    .where(eq(categories.slug, slug))
    .limit(1);
  return row ?? null;
}

/** A category's own id plus its children's, for inclusive listings. */
async function getCategoryWithDescendantIds(slug: string): Promise<string[]> {
  const category = await getCategoryBySlug(slug);
  if (!category) return [];

  const children = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.parentId, category.id));

  return [category.id, ...children.map((c) => c.id)];
}

/* --------------------------------------------------------------- author */

export async function getAuthorBySlug(slug: string) {
  const [row] = await db
    .select({
      id: users.id,
      name: users.name,
      slug: users.slug,
      bio: users.bio,
      avatarUrl: users.avatarUrl,
    })
    .from(users)
    .where(and(eq(users.slug, slug), eq(users.isActive, true)))
    .limit(1);
  return row ?? null;
}

export async function getArticlesByAuthor(
  authorId: string,
  limit = 20,
): Promise<ArticleListing[]> {
  return baseListingQuery()
    .where(and(isLive, eq(articles.authorId, authorId)))
    .orderBy(desc(articles.publishedAt))
    .limit(limit);
}

/* ------------------------------------------------------------------ tag */

export async function getTagBySlug(slug: string) {
  const [row] = await db
    .select()
    .from(tags)
    .where(eq(tags.slug, slug))
    .limit(1);
  return row ?? null;
}

export async function getArticlesByTag(
  tagId: string,
  limit = 20,
): Promise<ArticleListing[]> {
  return db
    .select(listingColumns)
    .from(articleTags)
    .innerJoin(articles, eq(articleTags.articleId, articles.id))
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(users, eq(articles.authorId, users.id))
    .where(and(eq(articleTags.tagId, tagId), isLive))
    .orderBy(desc(articles.publishedAt))
    .limit(limit);
}

/* --------------------------------------------------------------- search */

export async function searchArticles(
  query: string,
  limit = 25,
): Promise<ArticleListing[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  // Postgres full-text over title + dek + body, with an ILIKE fallback so
  // partial words ("Tinu") still match. websearch_to_tsquery handles quoted
  // phrases and OR/-- operators the way users expect from a search box.
  const pattern = `%${trimmed}%`;

  return baseListingQuery()
    .where(
      and(
        isLive,
        or(
          sql`to_tsvector('english', ${articles.title} || ' ' || coalesce(${articles.dek}, '') || ' ' || coalesce(${articles.body}, '')) @@ websearch_to_tsquery('english', ${trimmed})`,
          sql`${articles.title} ilike ${pattern}`,
        ),
      ),
    )
    .orderBy(desc(articles.publishedAt))
    .limit(limit);
}

/* -------------------------------------------------------------- sitemap */

export async function getAllPublishedSlugs() {
  return db
    .select({
      slug: articles.slug,
      categorySlug: categories.slug,
      publishedAt: articles.publishedAt,
      updatedAt: articles.updatedAt,
      title: articles.title,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .where(isLive)
    .orderBy(desc(articles.publishedAt));
}

/** Google News only indexes the last 48 hours. */
export async function getRecentArticlesForNewsSitemap() {
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);
  return db
    .select({
      slug: articles.slug,
      categorySlug: categories.slug,
      title: articles.title,
      publishedAt: articles.publishedAt,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .where(and(isLive, gte(articles.publishedAt, cutoff)))
    .orderBy(desc(articles.publishedAt))
    .limit(1000);
}

/** Canonical public URL for an article. */
export function articleHref(
  categorySlug: string | null,
  slug: string,
): string {
  return `/${categorySlug ?? "news"}/${slug}`;
}
