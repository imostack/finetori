import { asc, count, eq } from "drizzle-orm";

import { db } from "@/db";
import { articles, categories } from "@/db/schema";
import { requireUser } from "@/lib/auth";

export const metadata = { title: "Categories" };
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  await requireUser("editor");

  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      parentId: categories.parentId,
      description: categories.description,
      articleCount: count(articles.id),
    })
    .from(categories)
    .leftJoin(articles, eq(articles.categoryId, categories.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder), asc(categories.name));

  const parents = rows.filter((r) => !r.parentId);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Categories</h1>
        <p className="mt-1 text-sm text-neutral-600">
          The site&apos;s section taxonomy. A category slug is also its URL, so
          renaming one changes every article path beneath it — edit these in
          the seed script rather than live once you have traffic.
        </p>
      </header>

      <div className="space-y-3">
        {parents.map((parent) => {
          const children = rows.filter((r) => r.parentId === parent.id);
          return (
            <div
              key={parent.id}
              className="rounded-lg border border-neutral-200 bg-white p-4"
            >
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <h2 className="font-semibold">{parent.name}</h2>
                  <code className="text-xs text-neutral-500">
                    /{parent.slug}
                  </code>
                </div>
                <span className="shrink-0 text-sm tabular-nums text-neutral-500">
                  {parent.articleCount} article
                  {parent.articleCount === 1 ? "" : "s"}
                </span>
              </div>

              {parent.description ? (
                <p className="mt-1 text-sm text-neutral-600">
                  {parent.description}
                </p>
              ) : null}

              {children.length > 0 ? (
                <ul className="mt-3 divide-y divide-neutral-100 border-t border-neutral-100 pt-1">
                  {children.map((child) => (
                    <li
                      key={child.id}
                      className="flex items-baseline justify-between gap-4 py-1.5 text-sm"
                    >
                      <span className="pl-4 text-neutral-700">
                        {child.name}{" "}
                        <code className="text-xs text-neutral-400">
                          /{child.slug}
                        </code>
                      </span>
                      <span className="tabular-nums text-neutral-500">
                        {child.articleCount}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
