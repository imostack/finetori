import { asc } from "drizzle-orm";

import { db } from "@/db";
import { newsletterSubscribers } from "@/db/schema";
import { requireUserApi } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Escapes a value for CSV, including the leading-character injection guard. */
function csvCell(value: string | null): string {
  if (!value) return "";
  // A cell starting with =, +, - or @ is executed as a formula by Excel and
  // Sheets. Prefix it so an address like "=cmd|..." cannot run on open.
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export async function GET() {
  const auth = await requireUserApi("editor");
  if ("error" in auth) return auth.error;

  const rows = await db
    .select({
      email: newsletterSubscribers.email,
      source: newsletterSubscribers.source,
      createdAt: newsletterSubscribers.createdAt,
      unsubscribedAt: newsletterSubscribers.unsubscribedAt,
    })
    .from(newsletterSubscribers)
    .orderBy(asc(newsletterSubscribers.createdAt));

  const header = "email,source,subscribed_at,unsubscribed_at";
  const body = rows
    .map((r) =>
      [
        csvCell(r.email),
        csvCell(r.source),
        csvCell(r.createdAt.toISOString()),
        csvCell(r.unsubscribedAt?.toISOString() ?? null),
      ].join(","),
    )
    .join("\n");

  const filename = `finetori-subscribers-${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(`${header}\n${body}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
