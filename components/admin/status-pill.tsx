import type { ArticleStatus } from "@/db/schema";

const STATUS_STYLES: Record<ArticleStatus, string> = {
  published: "bg-green-100 text-green-800",
  in_review: "bg-amber-100 text-amber-800",
  draft: "bg-neutral-100 text-neutral-700",
  scheduled: "bg-blue-100 text-blue-800",
  archived: "bg-neutral-100 text-neutral-500",
};

export function StatusPill({ status }: { status: ArticleStatus }) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium capitalize ${STATUS_STYLES[status]}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}
