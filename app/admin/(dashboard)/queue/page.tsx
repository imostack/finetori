import Link from "next/link";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { articles, categories, clusters } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { relativeTime } from "@/lib/utils";

export const metadata = { title: "Review queue" };
export const dynamic = "force-dynamic";

export default async function QueuePage(props: PageProps<"/admin/queue">) {
  await requireUser("editor");
  const { rejected } = await props.searchParams;

  const drafts = await db
    .select({
      id: articles.id,
      title: articles.title,
      dek: articles.dek,
      createdAt: articles.createdAt,
      coverImageUrl: articles.coverImageUrl,
      sourceAttribution: articles.sourceAttribution,
      categoryName: categories.name,
      clusterScore: clusters.score,
      clusterItems: clusters.itemCount,
    })
    .from(articles)
    .leftJoin(categories, eq(articles.categoryId, categories.id))
    .leftJoin(clusters, eq(articles.clusterId, clusters.id))
    .where(eq(articles.status, "in_review"))
    .orderBy(desc(articles.createdAt));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Review queue</h1>
        <p className="mt-1 text-sm text-neutral-600">
          AI-assembled drafts awaiting an editor. Nothing here is public until
          you publish it.
        </p>
      </header>

      {rejected ? (
        <p
          role="status"
          className="rounded-md bg-neutral-100 px-4 py-3 text-sm text-neutral-700"
        >
          Draft rejected. Its cluster will not be drafted again.
        </p>
      ) : null}

      {drafts.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white py-16 text-center">
          <p className="font-medium">The queue is empty.</p>
          <p className="mt-1 text-sm text-neutral-500">
            The ingestion job runs hourly. New drafts will appear here as
            stories break.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {drafts.map((draft) => {
            const sourceCount = draft.sourceAttribution?.length ?? 0;
            return (
              <li
                key={draft.id}
                className="rounded-lg border border-neutral-200 bg-white p-4 transition hover:border-neutral-300"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                      {draft.categoryName ? (
                        <span className="rounded bg-brand-50 px-2 py-0.5 font-semibold uppercase tracking-wide text-brand-700">
                          {draft.categoryName}
                        </span>
                      ) : (
                        <span className="rounded bg-red-50 px-2 py-0.5 font-semibold uppercase tracking-wide text-red-700">
                          No section
                        </span>
                      )}
                      <span className="text-neutral-500">
                        {sourceCount} source{sourceCount === 1 ? "" : "s"}
                      </span>
                      {draft.clusterScore != null ? (
                        <span className="text-neutral-400">
                          score {draft.clusterScore.toFixed(1)}
                        </span>
                      ) : null}
                      <span className="text-neutral-400">
                        {relativeTime(draft.createdAt)}
                      </span>
                      {!draft.coverImageUrl ? (
                        <span className="rounded bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                          Needs image
                        </span>
                      ) : null}
                    </div>

                    <h2 className="text-base font-semibold leading-snug">
                      <Link
                        href={`/admin/posts/${draft.id}/edit`}
                        className="underline-offset-4 hover:underline"
                      >
                        {draft.title}
                      </Link>
                    </h2>

                    {draft.dek ? (
                      <p className="mt-1 line-clamp-2 text-sm text-neutral-600">
                        {draft.dek}
                      </p>
                    ) : null}
                  </div>

                  <Link
                    href={`/admin/posts/${draft.id}/edit`}
                    className="shrink-0 rounded-md bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700"
                  >
                    Review
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
