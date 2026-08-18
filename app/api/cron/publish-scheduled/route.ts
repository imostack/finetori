import { and, eq, isNotNull, lte } from "drizzle-orm";

import { db } from "@/db";
import { articles } from "@/db/schema";
import { isAgentPaused } from "@/lib/agent-status";
import { publishArticle } from "@/lib/publish";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Publishes articles whose scheduled time has arrived. Runs every 5 minutes.
 *
 * Goes through `publishArticle` rather than flipping the status directly, so
 * scheduled stories are held to the same invariants (byline, section, cover
 * image) as anything published by hand.
 */
async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isAgentPaused()) {
    console.log("[publish-scheduled] skipped: agent paused");
    return Response.json({ paused: true });
  }

  const due = await db
    .select({ id: articles.id, title: articles.title })
    .from(articles)
    .where(
      and(
        eq(articles.status, "scheduled"),
        isNotNull(articles.scheduledFor),
        lte(articles.scheduledFor, new Date()),
      ),
    )
    .limit(50);

  const published: string[] = [];
  const skipped: { title: string; reason: string }[] = [];

  for (const article of due) {
    const result = await publishArticle(article.id, null, {
      auditAction: "publish_scheduled",
    });
    if (result.ok) published.push(article.title);
    else skipped.push({ title: article.title, reason: result.error });
  }

  if (skipped.length > 0) {
    console.warn("[publish-scheduled] skipped:", JSON.stringify(skipped));
  }

  return Response.json({
    due: due.length,
    published: published.length,
    skipped,
  });
}

export const GET = handle;
export const POST = handle;
