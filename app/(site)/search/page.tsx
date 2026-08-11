import type { Metadata } from "next";

import { searchArticles } from "@/lib/queries";
import { siteConfig } from "@/lib/site";
import { ArticleCard } from "@/components/site/article-card";

export const metadata: Metadata = {
  title: "Search",
  description: `Search ${siteConfig.name} for news, politics, business, sport and entertainment.`,
  // Search result pages are thin and infinite; keep them out of the index.
  robots: { index: false, follow: true },
};

export default async function SearchPage(props: PageProps<"/search">) {
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q : "";
  const results = query ? await searchArticles(query, 30) : [];

  return (
    <div className="mx-auto max-w-[1200px] px-4 py-8">
      <h1 className="text-2xl font-black tracking-tight">Search</h1>

      <form action="/search" className="mt-4 flex max-w-xl gap-2">
        <label htmlFor="q" className="sr-only">
          Search term
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Search Finetori…"
          className="min-w-0 flex-1 rounded-md border border-neutral-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand-700"
        />
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-700"
        >
          Search
        </button>
      </form>

      {query ? (
        <p className="mt-6 text-sm text-neutral-600">
          {results.length === 0
            ? `No results for “${query}”.`
            : `${results.length} result${results.length === 1 ? "" : "s"} for “${query}”.`}
        </p>
      ) : null}

      {results.length > 0 ? (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {results.map((a) => (
            <ArticleCard key={a.id} article={a} variant="medium" />
          ))}
        </div>
      ) : null}
    </div>
  );
}
