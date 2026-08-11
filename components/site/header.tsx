import Link from "next/link";

import { getTopLevelCategories, getBreakingArticle, articleHref } from "@/lib/queries";
import { siteConfig } from "@/lib/site";
import { MobileNav } from "./mobile-nav";

export async function SiteHeader() {
  const [navCategories, breaking] = await Promise.all([
    getTopLevelCategories(),
    getBreakingArticle(),
  ]);

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white">
      {/* Breaking bar — only rendered when there is a live breaking story. */}
      {breaking ? (
        <div className="bg-breaking text-white">
          <div className="mx-auto flex max-w-[1200px] items-center gap-3 px-4 py-2">
            <span className="shrink-0 rounded bg-white/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider">
              Breaking
            </span>
            <Link
              href={articleHref(breaking.categorySlug, breaking.slug)}
              className="truncate text-sm font-medium hover:underline"
            >
              {breaking.title}
            </Link>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-[1200px] px-4">
        <div className="flex h-16 items-center justify-between gap-4">
          <Link href="/" className="shrink-0">
            <span className="text-2xl font-black tracking-tight text-neutral-900">
              {siteConfig.name}
            </span>
          </Link>

          <nav
            aria-label="Sections"
            className="hidden flex-1 items-center justify-center gap-5 lg:flex"
          >
            {navCategories.slice(0, 8).map((c) => (
              <Link
                key={c.id}
                href={`/${c.slug}`}
                className="whitespace-nowrap text-sm font-medium text-neutral-700 transition hover:text-brand-700"
              >
                {c.name}
              </Link>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2">
            <form action="/search" className="hidden sm:block">
              <label htmlFor="site-search" className="sr-only">
                Search Finetori
              </label>
              <input
                id="site-search"
                type="search"
                name="q"
                placeholder="Search…"
                className="w-40 rounded-full border border-neutral-300 px-3.5 py-1.5 text-sm outline-none transition focus:w-52 focus:border-brand-700"
              />
            </form>
            <MobileNav
              categories={navCategories.map((c) => ({
                slug: c.slug,
                name: c.name,
              }))}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
