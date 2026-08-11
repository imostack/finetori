import { sql } from "drizzle-orm";

import { db } from "@/db";
import { articleViews } from "@/db/schema";

// Written on every article view, so it must never be cached.
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(
  _request: Request,
  context: RouteContext<"/api/views/[id]">,
) {
  const { id } = await context.params;

  // Reject anything that isn't a UUID before it reaches the database — the
  // articleId is a foreign key, and a malformed value would raise instead of
  // failing quietly.
  if (!UUID_RE.test(id)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);

  try {
    // Single-statement upsert into the daily rollup: no read-then-write race
    // when two readers open the same article at once.
    await db
      .insert(articleViews)
      .values({ articleId: id, day: today, count: 1 })
      .onConflictDoUpdate({
        target: [articleViews.articleId, articleViews.day],
        set: { count: sql`${articleViews.count} + 1` },
      });
  } catch {
    // A view ping must never surface an error to the reader; an unknown
    // article id simply means there is nothing to count.
    return new Response(null, { status: 204 });
  }

  return new Response(null, { status: 204 });
}
