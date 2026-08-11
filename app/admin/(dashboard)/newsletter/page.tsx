import { desc, isNull, count } from "drizzle-orm";

import { db } from "@/db";
import { newsletterSubscribers } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Newsletter" };
export const dynamic = "force-dynamic";

export default async function NewsletterPage() {
  await requireUser("editor");

  const [[active], [total], recent] = await Promise.all([
    db
      .select({ value: count() })
      .from(newsletterSubscribers)
      .where(isNull(newsletterSubscribers.unsubscribedAt)),
    db.select({ value: count() }).from(newsletterSubscribers),
    db
      .select({
        id: newsletterSubscribers.id,
        email: newsletterSubscribers.email,
        source: newsletterSubscribers.source,
        createdAt: newsletterSubscribers.createdAt,
        unsubscribedAt: newsletterSubscribers.unsubscribedAt,
      })
      .from(newsletterSubscribers)
      .orderBy(desc(newsletterSubscribers.createdAt))
      .limit(100),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Newsletter</h1>
          <p className="mt-1 text-sm text-neutral-600">
            {active.value} active subscriber
            {active.value === 1 ? "" : "s"} of {total.value} total.
          </p>
        </div>
        <a
          href="/api/newsletter/export"
          className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold transition hover:border-neutral-900"
        >
          Export CSV
        </a>
      </header>

      <p className="rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Signups are captured and stored here. Sending is not wired up yet —
        export the list into your email platform, or ask for Resend to be
        connected.
      </p>

      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        {recent.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-neutral-500">
            No subscribers yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-2.5 font-medium">Email</th>
                <th className="w-32 px-4 py-2.5 font-medium">Source</th>
                <th className="w-32 px-4 py-2.5 font-medium">Joined</th>
                <th className="w-28 px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {recent.map((row) => (
                <tr key={row.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-2.5 font-medium">{row.email}</td>
                  <td className="px-4 py-2.5 text-neutral-600">
                    {row.source ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-neutral-500">
                    {formatDate(row.createdAt)}
                  </td>
                  <td className="px-4 py-2.5">
                    {row.unsubscribedAt ? (
                      <span className="text-xs text-neutral-500">
                        Unsubscribed
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-green-700">
                        Active
                      </span>
                    )}
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
