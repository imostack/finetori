import { isAgentPaused } from "@/lib/agent-status";
import { runIngestion } from "@/lib/ingest/run";

export const dynamic = "force-dynamic";
// Ingestion fans out to every feed and then makes N model calls; the default
// serverless timeout is nowhere near enough.
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  // Fail closed. An unset secret must not mean "open to everyone".
  if (!secret) return false;

  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isAgentPaused()) {
    console.log("[ingest] skipped: agent paused");
    return Response.json({ paused: true });
  }

  const url = new URL(request.url);
  const maxParam = Number(url.searchParams.get("max"));
  const maxDrafts =
    Number.isFinite(maxParam) && maxParam > 0
      ? Math.min(maxParam, 25)
      : undefined;

  try {
    const report = await runIngestion(maxDrafts);
    console.log("[ingest]", JSON.stringify(report));
    return Response.json(report);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[ingest] run failed:", message);
    return Response.json({ error: message }, { status: 500 });
  }
}

// Both verbs are accepted so any scheduler works: the GitHub Actions workflow
// and shell triggers POST, while most hosted cron services only issue a GET.
export const GET = handle;
export const POST = handle;
