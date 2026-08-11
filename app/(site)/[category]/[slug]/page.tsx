import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";

import {
  articleHref,
  getArticleBySlug,
  getArticleTags,
  getRelatedArticles,
  getTrendingArticles,
} from "@/lib/queries";
import { absoluteUrl, siteConfig } from "@/lib/site";
import { formatDateTime, plainExcerpt, readingTimeMinutes } from "@/lib/utils";
import { AdSlot } from "@/components/site/ad-slot";
import { ArticleCard } from "@/components/site/article-card";
import { ViewTracker } from "@/components/site/view-tracker";

// Articles are immutable-ish once published; on-demand revalidation on edit
// keeps them fresh, and 5 minutes bounds staleness if that ever misfires.
export const revalidate = 300;

export async function generateMetadata(
  props: PageProps<"/[category]/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const article = await getArticleBySlug(slug);
  if (!article) return { title: "Article not found" };

  const title = article.seoTitle || article.title;
  const description =
    article.seoDescription ||
    article.excerpt ||
    plainExcerpt(article.body, 160);
  const url = absoluteUrl(articleHref(article.categorySlug, article.slug));
  const images = article.coverImageUrl ? [article.coverImageUrl] : [];

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      title,
      description,
      url,
      images,
      siteName: siteConfig.name,
      publishedTime: article.publishedAt?.toISOString(),
      modifiedTime: article.updatedAt?.toISOString(),
      authors: article.authorName ? [article.authorName] : undefined,
      section: article.categoryName ?? undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images,
    },
  };
}

export default async function ArticlePage(
  props: PageProps<"/[category]/[slug]">,
) {
  const { category: categoryParam, slug } = await props.params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  // Slugs are globally unique, so an article reached under the wrong category
  // path is a stale link — send it to the canonical URL rather than serving
  // the same content at two URLs and splitting its ranking.
  const canonicalCategory = article.categorySlug ?? "news";
  if (categoryParam !== canonicalCategory) {
    permanentRedirect(articleHref(article.categorySlug, article.slug));
  }

  const [articleTags, related, trending] = await Promise.all([
    getArticleTags(article.id),
    getRelatedArticles(article.id, article.categoryId, 4),
    getTrendingArticles(5),
  ]);

  const url = absoluteUrl(articleHref(article.categorySlug, article.slug));
  const description =
    article.seoDescription ||
    article.excerpt ||
    plainExcerpt(article.body, 160);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: article.title.slice(0, 110),
    description,
    image: article.coverImageUrl ? [article.coverImageUrl] : undefined,
    datePublished: article.publishedAt?.toISOString(),
    dateModified: (article.updatedAt ?? article.publishedAt)?.toISOString(),
    author: article.authorName
      ? {
          "@type": "Person",
          name: article.authorName,
          url: article.authorSlug
            ? absoluteUrl(`/author/${article.authorSlug}`)
            : undefined,
        }
      : { "@type": "Organization", name: siteConfig.name },
    publisher: {
      "@type": "Organization",
      name: siteConfig.name,
      url: siteConfig.url,
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    articleSection: article.categoryName ?? undefined,
    inLanguage: "en-NG",
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: siteConfig.url },
      article.categoryName && article.categorySlug
        ? {
            "@type": "ListItem",
            position: 2,
            name: article.categoryName,
            item: absoluteUrl(`/${article.categorySlug}`),
          }
        : null,
      { "@type": "ListItem", position: 3, name: article.title, item: url },
    ].filter(Boolean),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <ViewTracker articleId={article.id} />

      <div className="mx-auto max-w-[1200px] px-4 py-6">
        <div className="grid gap-10 lg:grid-cols-3">
          <article className="lg:col-span-2">
            <nav aria-label="Breadcrumb" className="mb-3 text-sm">
              <ol className="flex items-center gap-1.5 text-neutral-500">
                <li>
                  <Link href="/" className="hover:text-brand-700">
                    Home
                  </Link>
                </li>
                {article.categoryName && article.categorySlug ? (
                  <>
                    <li aria-hidden="true">/</li>
                    <li>
                      <Link
                        href={`/${article.categorySlug}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {article.categoryName}
                      </Link>
                    </li>
                  </>
                ) : null}
              </ol>
            </nav>

            <header>
              {article.isBreaking ? (
                <span className="mb-2 inline-block rounded bg-breaking px-2 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                  Breaking
                </span>
              ) : null}

              <h1 className="text-3xl font-black leading-tight tracking-tight md:text-4xl">
                {article.title}
              </h1>

              {article.dek ? (
                <p className="mt-3 text-lg leading-relaxed text-neutral-600">
                  {article.dek}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-y border-neutral-200 py-3 text-sm text-neutral-600">
                {article.authorName ? (
                  <span>
                    By{" "}
                    {article.authorSlug ? (
                      <Link
                        href={`/author/${article.authorSlug}`}
                        className="font-semibold text-neutral-900 hover:underline"
                      >
                        {article.authorName}
                      </Link>
                    ) : (
                      <span className="font-semibold text-neutral-900">
                        {article.authorName}
                      </span>
                    )}
                  </span>
                ) : null}
                {article.publishedAt ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <time
                      dateTime={new Date(article.publishedAt).toISOString()}
                    >
                      {formatDateTime(article.publishedAt)}
                    </time>
                  </>
                ) : null}
                <span aria-hidden="true">·</span>
                <span>{readingTimeMinutes(article.body)} min read</span>
              </div>
            </header>

            {article.coverImageUrl ? (
              <figure className="mt-5">
                <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-neutral-100">
                  <Image
                    src={article.coverImageUrl}
                    alt={article.coverCaption ?? article.title}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 800px"
                    className="object-cover"
                  />
                </div>
                {article.coverCaption || article.coverCredit ? (
                  <figcaption className="mt-2 text-sm text-neutral-500">
                    {article.coverCaption}
                    {article.coverCredit ? (
                      <span className="ml-1 italic">
                        ({article.coverCredit})
                      </span>
                    ) : null}
                  </figcaption>
                ) : null}
              </figure>
            ) : null}

            <div
              className="article-body mt-6"
              // Body HTML is produced by the newsroom editor and sanitized on
              // save (lib/sanitize.ts) — never rendered straight from a feed.
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: article.body }}
            />

            <AdSlot format="in-article" className="my-8" />

            {/* Attribution is mandatory for AI-assisted reporting. */}
            {article.sourceAttribution &&
            article.sourceAttribution.length > 0 ? (
              <section className="mt-8 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                <h2 className="text-sm font-bold uppercase tracking-wide text-neutral-700">
                  Sources
                </h2>
                <ul className="mt-2 space-y-1 text-sm">
                  {article.sourceAttribution.map((s) => (
                    <li key={s.url}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="text-brand-700 underline-offset-2 hover:underline"
                      >
                        {s.name}
                      </a>
                    </li>
                  ))}
                </ul>
                {article.aiGenerated ? (
                  <p className="mt-3 text-xs italic text-neutral-500">
                    This report was compiled with AI assistance from the
                    sources above and reviewed by a {siteConfig.name} editor
                    before publication.
                  </p>
                ) : null}
              </section>
            ) : null}

            {articleTags.length > 0 ? (
              <div className="mt-6 flex flex-wrap gap-2">
                {articleTags.map((t) => (
                  <Link
                    key={t.slug}
                    href={`/tag/${t.slug}`}
                    className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700 transition hover:border-brand-700 hover:text-brand-700"
                  >
                    {t.name}
                  </Link>
                ))}
              </div>
            ) : null}

            {article.authorName && article.authorBio ? (
              <section className="mt-8 flex gap-4 rounded-lg border border-neutral-200 p-4">
                {article.authorAvatarUrl ? (
                  <Image
                    src={article.authorAvatarUrl}
                    alt=""
                    width={56}
                    height={56}
                    className="h-14 w-14 shrink-0 rounded-full object-cover"
                  />
                ) : null}
                <div>
                  <h2 className="font-bold">{article.authorName}</h2>
                  <p className="mt-1 text-sm text-neutral-600">
                    {article.authorBio}
                  </p>
                </div>
              </section>
            ) : null}

            {related.length > 0 ? (
              <section className="mt-12">
                <h2 className="mb-4 border-b-2 border-neutral-900 pb-2 text-lg font-black uppercase tracking-tight">
                  Read next
                </h2>
                <div className="grid gap-6 sm:grid-cols-2">
                  {related.map((a) => (
                    <ArticleCard key={a.id} article={a} variant="medium" />
                  ))}
                </div>
              </section>
            ) : null}
          </article>

          <aside className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              <div>
                <h2 className="mb-4 border-b-2 border-neutral-900 pb-2 text-lg font-black uppercase tracking-tight">
                  Trending
                </h2>
                <div className="space-y-4">
                  {trending.map((a) => (
                    <ArticleCard key={a.id} article={a} variant="small" />
                  ))}
                </div>
              </div>
              <AdSlot format="sidebar" />
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
