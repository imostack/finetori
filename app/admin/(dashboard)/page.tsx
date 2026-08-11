import Link from "next/link";
import { count, desc, eq, gte, sql } from "drizzle-orm";

import { db } from "@/db";
import { articles, articleViews, users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { relativeTime } from "@/lib/utils";
import { StatusPill } from "@/components/admin/status-pill";

export const metadata = { title: "Dashboard" };

function StatCard({
  label,
  value,
  href,
  accent,
}: {
  label: string;
  value: number | string;
  href?: string;
  accent?: boolean;
}) {
  const body = (
    <div
      className={`rounded-lg border p-4 transition ${
        accent
          ? "border-amber-300 bg-amber-50 hover:border-amber-400"
          : "border-neutral-200 bg-white hover:border-neutral-300"
      }`}
    >
      <p className="text-sm text-neutral-600">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export default async function AdminDashboard(
  props: PageProps<"/admin">,
) {
  const user = await requireUser("writer");
  const { denied } = await props.searchParams;

  const today = new Date().toISOString().slice(0, 10);

  const [
    [inReview],
    [published],
    [drafts],
    [scheduled],
    [viewsToday],
    recent,
  ] = await Promise.all([
    db
      .select({ value: count() })
      .from(articles)
      .where(eq(articles.status, "in_review")),
    db
      .select({ value: count() })
      .from(articles)
      .where(eq(articles.status, "published")),
    db
      .select({ value: count() })
      .from(articles)
      .where(eq(articles.status, "draft")),
    db
      .select({ value: count() })
      .from(articles)
      .where(eq(articles.status, "scheduled")),
    db
      .select({
        value: sql<number>`coalesce(sum(${articleViews.count}), 0)::int`,
      })
      .from(articleViews)
      .where(gte(articleViews.day, today)),
    db
      .select({
        id: articles.id,
        title: articles.title,
        status: articles.status,
        aiGenerated: articles.aiGenerated,
        updatedAt: articles.updatedAt,
        authorName: users.name,
      })
      .from(articles)
      .leftJoin(users, eq(articles.authorId, users.id))
      .orderBy(desc(articles.updatedAt))
      .limit(8),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">
          Good day, {user.name.split(" ")[0]}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Here is what is happening in the newsroom.
        </p>
      </header>

      {denied ? (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          You do not have permission to view that page.
        </p>
      ) : null}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard
          label="Awaiting review"
          value={inReview.value}
          href="/admin/queue"
          accent={inReview.value > 0}
        />
        <StatCard
          label="Published"
          value={published.value}
          href="/admin/posts?status=published"
        />
        <StatCard
          label="Drafts"
          value={drafts.value}
          href="/admin/posts?status=draft"
        />
        <StatCard
          label="Scheduled"
          value={scheduled.value}
          href="/admin/posts?status=scheduled"
        />
        <StatCard label="Views today" value={viewsToday.value} />
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Recently updated</h2>
          <Link
            href="/admin/posts"
            className="text-sm text-neutral-600 underline-offset-4 hover:underline"
          >
            All articles
          </Link>
        </div>

        <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
          {recent.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-neutral-500">
              No articles yet. Once the ingestion job runs, AI drafts will
              appear in the review queue.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Title</th>
                  <th className="w-32 px-4 py-2.5 font-medium">Status</th>
                  <th className="w-40 px-4 py-2.5 font-medium">Author</th>
                  <th className="w-32 px-4 py-2.5 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {recent.map((a) => (
                  <tr key={a.id} className="hover:bg-neutral-50">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/admin/posts/${a.id}/edit`}
                        className="font-medium underline-offset-4 hover:underline"
                      >
                        {a.title}
                      </Link>
                      {a.aiGenerated ? (
                        <span className="ml-2 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
                          AI
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusPill status={a.status} />
                    </td>
                    <td className="px-4 py-2.5 text-neutral-600">
                      {a.authorName ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-neutral-500">
                      {relativeTime(a.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

