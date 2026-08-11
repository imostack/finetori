import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getArticlesByTag, getTagBySlug } from "@/lib/queries";
import { absoluteUrl, siteConfig } from "@/lib/site";
import { ArticleCard } from "@/components/site/article-card";

export const revalidate = 300;

export async function generateMetadata(
  props: PageProps<"/tag/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const tag = await getTagBySlug(slug);
  if (!tag) return { title: "Tag not found" };

  return {
    title: `${tag.name} — latest news`,
    description: `All ${siteConfig.name} coverage tagged ${tag.name}.`,
    alternates: { canonical: absoluteUrl(`/tag/${tag.slug}`) },
  };
}

export default async function TagPage(props: PageProps<"/tag/[slug]">) {
  const { slug } = await props.params;
  const tag = await getTagBySlug(slug);
  if (!tag) notFound();

  const articles = await getArticlesByTag(tag.id, 30);

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8">
      <header className="border-b-2 border-neutral-900 pb-3">
        <p className="text-xs font-bold uppercase tracking-wider text-neutral-500">
          Tag
        </p>
        <h1 className="text-3xl font-black tracking-tight">{tag.name}</h1>
      </header>

      {articles.length === 0 ? (
        <p className="py-16 text-center text-neutral-500">
          Nothing tagged {tag.name} yet.
        </p>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {articles.map((a) => (
            <ArticleCard key={a.id} article={a} variant="medium" />
          ))}
        </div>
      )}
    </div>
  );
}
