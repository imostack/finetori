import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  countArticlesByCategory,
  getAllCategories,
  getArticlesByCategory,
  getCategoryBySlug,
} from "@/lib/queries";
import { absoluteUrl, siteConfig } from "@/lib/site";
import { AdSlot } from "@/components/site/ad-slot";
import { ArticleCard } from "@/components/site/article-card";

export const revalidate = 120;

const PER_PAGE = 16;

export async function generateMetadata(
  props: PageProps<"/[category]">,
): Promise<Metadata> {
  const { category: slug } = await props.params;
  const category = await getCategoryBySlug(slug);
  if (!category) return { title: "Section not found" };

  const title = `${category.name} news`;
  const description =
    category.description ??
    `The latest ${category.name.toLowerCase()} news and updates from ${siteConfig.name}.`;

  return {
    title,
    description,
    alternates: { canonical: absoluteUrl(`/${category.slug}`) },
    openGraph: {
      type: "website",
      title,
      description,
      url: absoluteUrl(`/${category.slug}`),
    },
  };
}

export default async function CategoryPage(
  props: PageProps<"/[category]">,
) {
  const { category: slug } = await props.params;
  const { page } = await props.searchParams;

  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const pageNumber = Math.max(1, Number(page) || 1);
  const offset = (pageNumber - 1) * PER_PAGE;

  const [articles, total, allCategories] = await Promise.all([
    getArticlesByCategory(slug, PER_PAGE, offset),
    countArticlesByCategory(slug),
    getAllCategories(),
  ]);

  const children = allCategories.filter((c) => c.parentId === category.id);
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6">
      <header className="border-b-2 border-neutral-900 pb-3">
        <h1 className="text-3xl font-black uppercase tracking-tight">
          {category.name}
        </h1>
        {category.description ? (
          <p className="mt-1.5 text-neutral-600">{category.description}</p>
        ) : null}
      </header>

      {children.length > 0 ? (
        <nav aria-label="Sub-sections" className="mt-4 flex flex-wrap gap-2">
          {children.map((c) => (
            <Link
              key={c.id}
              href={`/${c.slug}`}
              className="rounded-full border border-neutral-300 px-3 py-1 text-sm font-medium text-neutral-700 transition hover:border-brand-700 hover:text-brand-700"
            >
              {c.name}
            </Link>
          ))}
        </nav>
      ) : null}

      <AdSlot format="leaderboard" className="my-6" />

      {articles.length === 0 ? (
        <p className="py-16 text-center text-neutral-500">
          No stories in {category.name} yet. Check back shortly.
        </p>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {articles.map((a, i) => (
            <ArticleCard
              key={a.id}
              article={a}
              variant="medium"
              priority={i < 4}
            />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <nav
          aria-label="Pagination"
          className="mt-10 flex items-center justify-center gap-3 text-sm"
        >
          {pageNumber > 1 ? (
            <Link
              href={`/${category.slug}?page=${pageNumber - 1}`}
              className="rounded-md border border-neutral-300 px-4 py-2 font-medium transition hover:border-neutral-900"
            >
              ← Newer
            </Link>
          ) : null}
          <span className="text-neutral-500">
            Page {pageNumber} of {totalPages}
          </span>
          {pageNumber < totalPages ? (
            <Link
              href={`/${category.slug}?page=${pageNumber + 1}`}
              className="rounded-md border border-neutral-300 px-4 py-2 font-medium transition hover:border-neutral-900"
            >
              Older →
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
