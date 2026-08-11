import Link from "next/link";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";

import { db } from "@/db";
import { articles, categories, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { relativeTime } from "@/lib/utils";
import { StatusPill } from "@/components/admin/status-pill";
import { createArticleAction } from "./actions";
import type { ArticleStatus } from "@/db/schema";

export const metadata = { title: "Articles" };
export const dynamic = "force-dynamic";

const STATUSES: (ArticleStatus | "all")[] = [
  "all",
  "in_review",
  "draft",
  "scheduled",
  "published",
  "archived",
];

export default async function PostsPage(props: PageProps<"/admin/posts">) {
  const user = await requireUser("writer");
  const { status, q, published } = await props.searchParams;

  const statusFilter =
    typeof status === "string" &&
    STATUSES.includes(status as ArticleStatus)
      ? (status as ArticleStatus)
      : null;
  const search = typeof q === "string" ? q.trim() : "";

  const conditions: SQL[] = [];
  if (statusFilter) conditions.push(eq(articles.status, statusFilter));
  if (search) {
    const pattern = `%${search}%`;
    const match = or(
      ilike(articles.title, pattern),
      ilike(articles.slug, pattern),
    );
    if (match) conditions.push(match);
  }
  // Writers only see their own work.
  if (user.role === "writer") conditions.push(eq(articles.authorId, user.id));

  const rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      status: articles.status,
      aiGenerated: articles.aiGenerated,
      coverImageUrl: articles.coverImageUrl,
      updatedAt: articles.updatedAt,
      publishedAt: articles.publishedAt,
      scheduledFor: articles.scheduledFor,
      categoryName: categories.name,
      authorName: users.name,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(users, eq(articles.authorId, users.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(articles.updatedAt))
    .limit(100);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Articles</h1>
          <p className="mt-1 text-sm text-neutral-600">
            {user.role === "writer"
              ? "Your articles."
              : "Everything in the newsroom."}
          </p>
        </div>
        <form action={createArticleAction}>
          <button
            type="submit"
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700"
          >
            New article
          </button>
        </form>
      </header>

      {published ? (
        <p
          role="status"
          className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          Published. It is live on the site now.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <nav className="flex flex-wrap gap-1">
          {STATUSES.map((s) => {
            const active = s === "all" ? !statusFilter : statusFilter === s;
            const href =
              s === "all" ? "/admin/posts" : `/admin/posts?status=${s}`;
            return (
              <Link
                key={s}
                href={href}
                className={`rounded-md px-3 py-1.5 text-sm capitalize transition ${
                  active
                    ? "bg-neutral-900 font-medium text-white"
                    : "text-neutral-600 hover:bg-neutral-100"
                }`}
              >
                {s.replace("_", " ")}
              </Link>
            );
          })}
        </nav>

        <form action="/admin/posts" className="ml-auto flex gap-2">
          {statusFilter ? (
            <input type="hidden" name="status" value={statusFilter} />
          ) : null}
          <input
            name="q"
            type="search"
            defaultValue={search}
            placeholder="Search headlines…"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm outline-none focus:border-neutral-900"
          />
        </form>
      </div>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        {rows.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-neutral-500">
            Nothing here yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Headline</th>
                <th className="w-28 px-4 py-2.5 font-medium">Status</th>
                <th className="w-32 px-4 py-2.5 font-medium">Section</th>
                <th className="w-36 px-4 py-2.5 font-medium">Byline</th>
                <th className="w-28 px-4 py-2.5 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/admin/posts/${row.id}/edit`}
                      className="font-medium underline-offset-4 hover:underline"
                    >
                      {row.title}
                    </Link>
                    <span className="ml-2 inline-flex gap-1 align-middle">
                      {row.aiGenerated ? (
                        <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                          AI
                        </span>
                      ) : null}
                      {!row.coverImageUrl && row.status !== "published" ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800">
                          No image
                        </span>
                      ) : null}
                    </span>
                    {row.status === "scheduled" && row.scheduledFor ? (
                      <p className="mt-0.5 text-xs text-blue-700">
                        Publishes {relativeTime(row.scheduledFor)}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5">
                    <StatusPill status={row.status} />
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">
                    {row.categoryName ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-600">
                    {row.authorName ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-500">
                    {relativeTime(row.updatedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
