import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";

import { getArticlesByAuthor, getAuthorBySlug } from "@/lib/queries";
import { absoluteUrl, siteConfig } from "@/lib/site";
import { ArticleCard } from "@/components/site/article-card";

export const revalidate = 300;

export async function generateMetadata(
  props: PageProps<"/author/[slug]">,
): Promise<Metadata> {
  const { slug } = await props.params;
  const author = await getAuthorBySlug(slug);
  if (!author) return { title: "Author not found" };

  return {
    title: author.name,
    description:
      author.bio ?? `Stories by ${author.name} on ${siteConfig.name}.`,
    alternates: { canonical: absoluteUrl(`/author/${author.slug}`) },
  };
}

export default async function AuthorPage(
  props: PageProps<"/author/[slug]">,
) {
  const { slug } = await props.params;
  const author = await getAuthorBySlug(slug);
  if (!author) notFound();

  const articles = await getArticlesByAuthor(author.id, 24);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: author.name,
    description: author.bio ?? undefined,
    url: absoluteUrl(`/author/${author.slug}`),
    worksFor: { "@type": "Organization", name: siteConfig.name },
  };

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8">
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <header className="flex items-start gap-5 border-b border-neutral-200 pb-6">
        {author.avatarUrl ? (
          <Image
            src={author.avatarUrl}
            alt=""
            width={80}
            height={80}
            className="h-20 w-20 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brand-100 text-2xl font-bold text-brand-700"
          >
            {author.name.charAt(0)}
          </div>
        )}
        <div>
          <h1 className="text-3xl font-black tracking-tight">{author.name}</h1>
          {author.bio ? (
            <p className="mt-2 max-w-2xl text-neutral-600">{author.bio}</p>
          ) : null}
        </div>
      </header>

      {articles.length === 0 ? (
        <p className="py-16 text-center text-neutral-500">
          No published stories yet.
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
