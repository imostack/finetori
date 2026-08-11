import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { articles, categories, ingestedItems, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { ArticleForm, type ArticleFormData } from "./article-form";

export const metadata = { title: "Edit article" };
export const dynamic = "force-dynamic";

export default async function EditArticlePage(
  props: PageProps<"/admin/posts/[id]/edit">,
) {
  const user = await requireUser("writer");
  const { id } = await props.params;

  const [article] = await db
    .select()
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);

  if (!article) notFound();

  const canPublish = user.role === "editor" || user.role === "admin";

  // A writer may only open their own drafts.
  if (!canPublish && article.authorId !== user.id) {
    notFound();
  }

  const [categoryOptions, authorOptions] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .orderBy(asc(categories.sortOrder), asc(categories.name)),
    db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.isActive, true))
      .orderBy(asc(users.name)),
  ]);

  // For AI drafts, surface the original outlet's image so the editor knows
  // what the story looks like — clearly marked as reference only.
  let sourceImageSuggestion: string | null = null;
  if (article.clusterId) {
    const [item] = await db
      .select({ imageUrl: ingestedItems.imageUrl })
      .from(ingestedItems)
      .where(eq(ingestedItems.clusterId, article.clusterId))
      .limit(1);
    sourceImageSuggestion = item?.imageUrl ?? null;
  }

  const formData: ArticleFormData = {
    id: article.id,
    title: article.title,
    dek: article.dek,
    body: article.body,
    excerpt: article.excerpt,
    coverImageUrl: article.coverImageUrl,
    coverCaption: article.coverCaption,
    coverCredit: article.coverCredit,
    categoryId: article.categoryId,
    authorId: article.authorId,
    seoTitle: article.seoTitle,
    seoDescription: article.seoDescription,
    isBreaking: article.isBreaking,
    isFeatured: article.isFeatured,
    status: article.status,
    slug: article.slug,
    aiGenerated: article.aiGenerated,
    sourceAttribution: article.sourceAttribution,
  };

  return (
    <ArticleForm
      article={formData}
      categories={categoryOptions}
      authors={authorOptions}
      canPublish={canPublish}
      sourceImageSuggestion={sourceImageSuggestion}
    />
  );
}
