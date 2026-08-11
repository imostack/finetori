import type { Metadata } from "next";
import Link from "next/link";
import { count, eq } from "drizzle-orm";

import { db } from "@/db";
import { articles } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { siteConfig } from "@/lib/site";
import { AdminNav } from "./nav";
import { logoutAction } from "./actions";

export const metadata: Metadata = {
  title: { default: "Newsroom", template: `%s · ${siteConfig.name} Newsroom` },
  robots: { index: false, follow: false },
};

// Session state must never be cached across requests.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Authoritative check. proxy.ts already redirected anonymous requests, but
  // that is a convenience — this is the boundary that actually holds.
  const user = await requireUser("writer");

  const [{ value: queueCount }] = await db
    .select({ value: count() })
    .from(articles)
    .where(eq(articles.status, "in_review"));

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <div className="mx-auto flex max-w-[1400px]">
        <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-neutral-200 bg-white px-3 py-4">
          <Link href="/admin" className="mb-6 px-3">
            <span className="text-lg font-black tracking-tight">
              {siteConfig.name}
            </span>
            <span className="ml-1.5 align-super text-[10px] font-semibold uppercase tracking-wider text-amber-600">
              Newsroom
            </span>
          </Link>

          <AdminNav role={user.role} queueCount={queueCount} />

          <div className="mt-auto border-t border-neutral-200 pt-3">
            <Link
              href="/"
              target="_blank"
              className="block rounded-md px-3 py-2 text-sm text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
            >
              View site ↗
            </Link>
            <div className="mt-2 px-3">
              <p className="truncate text-sm font-medium">{user.name}</p>
              <p className="text-xs capitalize text-neutral-500">{user.role}</p>
            </div>
            <form action={logoutAction} className="mt-2">
              <button
                type="submit"
                className="w-full rounded-md px-3 py-2 text-left text-sm text-neutral-600 transition hover:bg-neutral-100 hover:text-neutral-900"
              >
                Sign out
              </button>
            </form>
          </div>
        </aside>

        <main className="min-w-0 flex-1 px-8 py-8">{children}</main>
      </div>
    </div>
  );
}
