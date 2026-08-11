import Link from "next/link";

import {
  getFeaturedArticle,
  getLatestArticles,
  getTrendingArticles,
  getTopLevelCategories,
  getArticlesByCategory,
} from "@/lib/queries";
import { AdSlot } from "@/components/site/ad-slot";
import { ArticleCard } from "@/components/site/article-card";
import { siteConfig } from "@/lib/site";

// Static shell, refreshed every 60s. Publishing also calls revalidatePath("/"),
// so an approved story appears immediately rather than waiting out the window.
export const revalidate = 60;

export const metadata = {
  title: `${siteConfig.name} — ${siteConfig.tagline}`,
  description: siteConfig.description,
  alternates: { canonical: "/" },
};

function SectionHeading({
  title,
  href,
}: {
  title: string;
  href?: string;
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between border-b-2 border-neutral-900 pb-2">
      <h2 className="text-lg font-black uppercase tracking-tight">{title}</h2>
      {href ? (
        <Link
          href={href}
          className="text-sm font-medium text-brand-700 hover:underline"
        >
          See more
        </Link>
      ) : null}
    </div>
  );
}

export default async function HomePage() {
  const [featured, latest, trending, categories] = await Promise.all([
    getFeaturedArticle(),
    getLatestArticles(13),
    getTrendingArticles(6),
    getTopLevelCategories(),
  ]);

  // Don't repeat the hero story in the grid below it.
  const rest = latest.filter((a) => a.id !== featured?.id);

  // Two category blocks on the homepage; the rest live on their own pages.
  const blockCategories = categories.slice(0, 3);
  const categoryBlocks = await Promise.all(
    blockCategories.map(async (c) => ({
      category: c,
      articles: await getArticlesByCategory(c.slug, 4),
    })),
  );

  const isEmpty = latest.length === 0 && !featured;

  if (isEmpty) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 py-24 text-center">
        <h1 className="text-3xl font-black tracking-tight">
          {siteConfig.name}
        </h1>
        <p className="mt-3 text-neutral-600">
          No stories published yet. Sign in to the newsroom to review and
          publish the first article.
        </p>
        <Link
          href="/admin"
          className="mt-6 inline-block rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700"
        >
          Go to newsroom
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-6">
      <AdSlot format="leaderboard" className="mb-6" />

      {/* Hero + trending rail */}
      <section className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {featured ? (
            <ArticleCard article={featured} variant="hero" priority />
          ) : null}

          {rest.length > 0 ? (
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {rest.slice(0, 4).map((a) => (
                <ArticleCard key={a.id} article={a} variant="medium" />
              ))}
            </div>
          ) : null}
        </div>

        <aside className="lg:col-span-1">
          <SectionHeading title="Trending" />
          <div className="space-y-4">
            {trending.map((a, i) => (
              <div key={a.id} className="flex gap-3">
                <span className="w-5 shrink-0 text-lg font-black tabular-nums text-neutral-300">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <ArticleCard article={a} variant="small" />
                </div>
              </div>
            ))}
          </div>
          <AdSlot format="rectangle" className="mt-6" />
        </aside>
      </section>

      {/* Latest strip */}
      {rest.length > 4 ? (
        <section className="mt-12">
          <SectionHeading title="Latest news" href="/news" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {rest.slice(4, 12).map((a) => (
              <ArticleCard key={a.id} article={a} variant="medium" />
            ))}
          </div>
        </section>
      ) : null}

      <AdSlot format="leaderboard" className="my-12" />

      {/* Per-category blocks */}
      {categoryBlocks.map(({ category, articles }) =>
        articles.length === 0 ? null : (
          <section key={category.id} className="mt-12">
            <SectionHeading title={category.name} href={`/${category.slug}`} />
            <div className="grid gap-6 md:grid-cols-3">
              <div className="md:col-span-1">
                <ArticleCard article={articles[0]} variant="large" />
              </div>
              <div className="space-y-4 md:col-span-2 md:grid md:grid-cols-2 md:gap-6 md:space-y-0">
                {articles.slice(1, 5).map((a) => (
                  <ArticleCard key={a.id} article={a} variant="text" />
                ))}
              </div>
            </div>
          </section>
        ),
      )}
    </div>
  );
}
