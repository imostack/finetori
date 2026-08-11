import "server-only";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { articles, auditLog, categories } from "@/db/schema";
import { articleHref } from "@/lib/queries";

/**
 * Invalidates every cached surface an article appears on.
 *
 * Called on publish, unpublish, and edit-after-publish. Missing one of these
 * is how a site ends up with a story that is live at its own URL but absent
 * from the homepage.
 */
export function revalidateArticleSurfaces(
  categorySlug: string | null,
  slug: string,
): void {
  revalidatePath("/");
  revalidatePath(articleHref(categorySlug, slug));
  if (categorySlug) revalidatePath(`/${categorySlug}`);
  revalidatePath("/rss.xml");
  revalidatePath("/news-sitemap.xml");
  revalidatePath("/sitemap.xml");
}

export type PublishOutcome =
  | { ok: true; slug: string; categorySlug: string | null }
  | { ok: false; error: string };

/**
 * Publishes an article after enforcing the invariants a story must satisfy
 * before it can go live.
 */
export async function publishArticle(
  articleId: string,
  actorId: string | null,
  options: { auditAction?: string } = {},
): Promise<PublishOutcome> {
  const [article] = await db
    .select({
      id: articles.id,
      slug: articles.slug,
      title: articles.title,
      body: articles.body,
      coverImageUrl: articles.coverImageUrl,
      categoryId: articles.categoryId,
      authorId: articles.authorId,
      status: articles.status,
      publishedAt: articles.publishedAt,
      clusterId: articles.clusterId,
    })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);

  if (!article) return { ok: false, error: "Article not found." };

  /* ---- publication invariants ---- */

  if (!article.title.trim()) {
    return { ok: false, error: "Give the article a headline first." };
  }
  if (!article.body.trim()) {
    return { ok: false, error: "The article has no body copy." };
  }
  if (!article.categoryId) {
    return { ok: false, error: "Assign the article to a section first." };
  }
  if (!article.authorId) {
    return { ok: false, error: "Assign a byline before publishing." };
  }
  // Enforced in code, not policy: source photographs belong to the outlets
  // that took them. An editor must attach an image we own or have licensed.
  if (!article.coverImageUrl) {
    return {
      ok: false,
      error:
        "Attach a cover image you own or have licensed. Source images cannot be republished.",
    };
  }

  const [category] = await db
    .select({ slug: categories.slug })
    .from(categories)
    .where(eq(categories.id, article.categoryId))
    .limit(1);

  const now = new Date();
  await db
    .update(articles)
    .set({
      status: "published",
      // Preserve the original publication time on re-publish so the article
      // does not jump back to the top of the feed after a typo fix.
      publishedAt: article.publishedAt ?? now,
      scheduledFor: null,
      updatedAt: now,
    })
    .where(eq(articles.id, articleId));

  await db.insert(auditLog).values({
    userId: actorId,
    action: options.auditAction ?? "publish",
    entity: "article",
    entityId: articleId,
    meta: {
      title: article.title,
      previousStatus: article.status,
      clusterId: article.clusterId,
    },
  });

  revalidateArticleSurfaces(category?.slug ?? null, article.slug);

  return { ok: true, slug: article.slug, categorySlug: category?.slug ?? null };
}

/** Takes a published article off the site without deleting it. */
export async function unpublishArticle(
  articleId: string,
  actorId: string | null,
): Promise<PublishOutcome> {
  const [article] = await db
    .select({
      slug: articles.slug,
      categoryId: articles.categoryId,
      title: articles.title,
    })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);

  if (!article) return { ok: false, error: "Article not found." };

  const [category] = article.categoryId
    ? await db
        .select({ slug: categories.slug })
        .from(categories)
        .where(eq(categories.id, article.categoryId))
        .limit(1)
    : [undefined];

  await db
    .update(articles)
    .set({ status: "draft", updatedAt: new Date() })
    .where(eq(articles.id, articleId));

  await db.insert(auditLog).values({
    userId: actorId,
    action: "unpublish",
    entity: "article",
    entityId: articleId,
    meta: { title: article.title },
  });

  revalidateArticleSurfaces(category?.slug ?? null, article.slug);

  return { ok: true, slug: article.slug, categorySlug: category?.slug ?? null };
}
