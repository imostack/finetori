import { asc, count, eq } from "drizzle-orm";

import { db } from "@/db";
import { ingestedItems, sources } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { relativeTime } from "@/lib/utils";
import { SourceForm } from "./source-form";
import { deleteSourceAction, toggleSourceAction } from "./actions";

export const metadata = { title: "News sources" };
export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  await requireUser("admin");

  const rows = await db
    .select({
      id: sources.id,
      name: sources.name,
      feedUrl: sources.feedUrl,
      enabled: sources.enabled,
      trustWeight: sources.trustWeight,
      lastFetchedAt: sources.lastFetchedAt,
      lastError: sources.lastError,
      itemCount: count(ingestedItems.id),
    })
    .from(sources)
    .leftJoin(ingestedItems, eq(ingestedItems.sourceId, sources.id))
    .groupBy(sources.id)
    .orderBy(asc(sources.name));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">News sources</h1>
        <p className="mt-1 text-sm text-neutral-600">
          The feeds the daily ingestion job reads. Disable a source to stop
          pulling from it without losing its history.
        </p>
      </header>

      <SourceForm />

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Source</th>
              <th className="w-24 px-4 py-2.5 font-medium">Trust</th>
              <th className="w-24 px-4 py-2.5 font-medium">Items</th>
              <th className="w-40 px-4 py-2.5 font-medium">Last fetch</th>
              <th className="w-44 px-4 py-2.5 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-neutral-500"
                >
                  No sources yet. Run <code>npm run db:seed</code> to load the
                  starter set, or add one above.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={`h-2 w-2 shrink-0 rounded-full ${
                          row.enabled ? "bg-green-500" : "bg-neutral-300"
                        }`}
                      />
                      <span className="font-medium">{row.name}</span>
                      {!row.enabled ? (
                        <span className="text-xs text-neutral-500">
                          (disabled)
                        </span>
                      ) : null}
                    </div>
                    <a
                      href={row.feedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 block truncate text-xs text-neutral-500 hover:underline"
                    >
                      {row.feedUrl}
                    </a>
                    {row.lastError ? (
                      <p className="mt-1 text-xs text-red-600">
                        Last error: {row.lastError}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-neutral-600">
                    {row.trustWeight.toFixed(1)}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-neutral-600">
                    {row.itemCount}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-500">
                    {row.lastFetchedAt
                      ? relativeTime(row.lastFetchedAt)
                      : "never"}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex gap-2">
                      <form action={toggleSourceAction}>
                        <input type="hidden" name="id" value={row.id} />
                        <input
                          type="hidden"
                          name="enabled"
                          value={String(row.enabled)}
                        />
                        <button
                          type="submit"
                          className="rounded border border-neutral-300 px-2.5 py-1 text-xs font-medium transition hover:border-neutral-900"
                        >
                          {row.enabled ? "Disable" : "Enable"}
                        </button>
                      </form>
                      <form action={deleteSourceAction}>
                        <input type="hidden" name="id" value={row.id} />
                        <button
                          type="submit"
                          className="rounded border border-red-200 px-2.5 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50"
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
