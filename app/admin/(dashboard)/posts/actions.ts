"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { articles, auditLog, categories, clusters } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { publishArticle, revalidateArticleSurfaces, unpublishArticle } from "@/lib/publish";
import { sanitizeArticleHtml, sanitizePlainText } from "@/lib/sanitize";
import { plainExcerpt, slugify } from "@/lib/utils";

export type ActionState = { error?: string; message?: string };

const articleSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(4, "Headline must be at least 4 characters."),
  dek: z.string().optional(),
  body: z.string().optional(),
  excerpt: z.string().optional(),
  coverImageUrl: z.string().optional(),
  coverCaption: z.string().optional(),
  coverCredit: z.string().optional(),
  categoryId: z.string().uuid().optional().or(z.literal("")),
  authorId: z.string().uuid().optional().or(z.literal("")),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  isBreaking: z.string().optional(),
  isFeatured: z.string().optional(),
  scheduledFor: z.string().optional(),
  intent: z.enum(["save", "publish", "schedule", "unpublish"]),
});

function readForm(formData: FormData) {
  return articleSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    dek: formData.get("dek") ?? undefined,
    body: formData.get("body") ?? undefined,
    excerpt: formData.get("excerpt") ?? undefined,
    coverImageUrl: formData.get("coverImageUrl") ?? undefined,
    coverCaption: formData.get("coverCaption") ?? undefined,
    coverCredit: formData.get("coverCredit") ?? undefined,
    categoryId: formData.get("categoryId") ?? undefined,
    authorId: formData.get("authorId") ?? undefined,
    seoTitle: formData.get("seoTitle") ?? undefined,
    seoDescription: formData.get("seoDescription") ?? undefined,
    isBreaking: formData.get("isBreaking") ?? undefined,
    isFeatured: formData.get("isFeatured") ?? undefined,
    scheduledFor: formData.get("scheduledFor") ?? undefined,
    intent: formData.get("intent"),
  });
}

/**
 * Single entry point for editing an article. Saves first, then applies the
 * requested transition, so "publish" never publishes a stale version of the
 * copy the editor is looking at.
 */
export async function saveArticleAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireUser("writer");

  const parsed = readForm(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const input = parsed.data;

  const [existing] = await db
    .select({
      id: articles.id,
      slug: articles.slug,
      status: articles.status,
      authorId: articles.authorId,
      title: articles.title,
      categoryId: articles.categoryId,
    })
    .from(articles)
    .where(eq(articles.id, input.id))
    .limit(1);

  if (!existing) return { error: "Article not found." };

  // Writers may only touch their own unpublished drafts; editors and admins
  // may touch anything.
  const isPrivileged = user.role === "editor" || user.role === "admin";
  if (!isPrivileged) {
    if (existing.authorId !== user.id) {
      return { error: "You can only edit articles assigned to you." };
    }
    if (existing.status === "published") {
      return { error: "Only an editor can change a published article." };
    }
    if (input.intent !== "save") {
      return { error: "Only an editor can publish or schedule." };
    }
  }

  const body = input.body ? sanitizeArticleHtml(input.body) : "";
  const title = sanitizePlainText(input.title).slice(0, 300);

  // Regenerate the slug from the headline while the article has never been
  // published; once it is live the URL is fixed so inbound links keep working.
  const slug =
    existing.status === "published"
      ? existing.slug
      : slugify(title) || existing.slug;

  await db
    .update(articles)
    .set({
      title,
      slug,
      dek: input.dek ? sanitizePlainText(input.dek).slice(0, 400) : null,
      body,
      excerpt:
        (input.excerpt ? sanitizePlainText(input.excerpt).slice(0, 400) : "") ||
        (body ? plainExcerpt(body, 200) : null),
      coverImageUrl: input.coverImageUrl || null,
      coverCaption: input.coverCaption
        ? sanitizePlainText(input.coverCaption).slice(0, 300)
        : null,
      coverCredit: input.coverCredit
        ? sanitizePlainText(input.coverCredit).slice(0, 200)
        : null,
      categoryId: input.categoryId || null,
      authorId: input.authorId || null,
      seoTitle: input.seoTitle
        ? sanitizePlainText(input.seoTitle).slice(0, 70)
        : null,
      seoDescription: input.seoDescription
        ? sanitizePlainText(input.seoDescription).slice(0, 200)
        : null,
      isBreaking: input.isBreaking === "on",
      isFeatured: input.isFeatured === "on",
      updatedAt: new Date(),
    })
    .where(eq(articles.id, input.id));

  /* ---- transitions ---- */

  if (input.intent === "publish") {
    const result = await publishArticle(input.id, user.id);
    if (!result.ok) return { error: result.error };
    redirect("/admin/posts?published=1");
  }

  if (input.intent === "unpublish") {
    const result = await unpublishArticle(input.id, user.id);
    if (!result.ok) return { error: result.error };
    return { message: "Article unpublished and returned to drafts." };
  }

  if (input.intent === "schedule") {
    if (!input.scheduledFor) {
      return { error: "Pick a date and time to schedule for." };
    }
    const when = new Date(input.scheduledFor);
    if (Number.isNaN(when.getTime())) {
      return { error: "That scheduled time is not a valid date." };
    }
    if (when.getTime() <= Date.now()) {
      return { error: "Scheduled time must be in the future." };
    }
    if (!input.coverImageUrl) {
      return {
        error:
          "Attach a cover image before scheduling — publication will fail without one.",
      };
    }

    await db
      .update(articles)
      .set({ status: "scheduled", scheduledFor: when })
      .where(eq(articles.id, input.id));

    await db.insert(auditLog).values({
      userId: user.id,
      action: "schedule",
      entity: "article",
      entityId: input.id,
      meta: { scheduledFor: when.toISOString(), title },
    });

    return { message: `Scheduled for ${when.toLocaleString("en-NG")}.` };
  }

  // Plain save. Refresh the public surfaces if the article is already live.
  if (existing.status === "published") {
    const [category] = input.categoryId
      ? await db
          .select({ slug: categories.slug })
          .from(categories)
          .where(eq(categories.id, input.categoryId))
          .limit(1)
      : [undefined];
    revalidateArticleSurfaces(category?.slug ?? null, slug);
  }

  revalidatePath("/admin/posts");
  revalidatePath(`/admin/posts/${input.id}/edit`);

  return { message: "Saved." };
}

/* -------------------------------------------------------------- queue ops */

/** Rejects an AI draft and stops its cluster being re-drafted. */
export async function rejectDraftAction(formData: FormData): Promise<void> {
  const user = await requireUser("editor");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const [article] = await db
    .select({ title: articles.title, clusterId: articles.clusterId })
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);

  if (!article) return;

  await db
    .update(articles)
    .set({ status: "archived", updatedAt: new Date() })
    .where(eq(articles.id, id));

  if (article.clusterId) {
    await db
      .update(clusters)
      .set({ status: "rejected", failureReason: "rejected by editor" })
      .where(eq(clusters.id, article.clusterId));
  }

  await db.insert(auditLog).values({
    userId: user.id,
    action: "reject_draft",
    entity: "article",
    entityId: id,
    meta: { title: article.title },
  });

  revalidatePath("/admin/queue");
  redirect("/admin/queue?rejected=1");
}

/** Creates a blank article and drops the writer straight into the editor. */
export async function createArticleAction(): Promise<void> {
  const user = await requireUser("writer");

  const [created] = await db
    .insert(articles)
    .values({
      title: "Untitled story",
      slug: `untitled-${Date.now()}`,
      body: "",
      status: "draft",
      authorId: user.id,
    })
    .returning({ id: articles.id });

  redirect(`/admin/posts/${created.id}/edit`);
}
