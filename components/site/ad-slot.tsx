import { cn } from "@/lib/utils";

type AdFormat = "leaderboard" | "rectangle" | "in-article" | "sidebar";

// Heights are reserved up front so the layout never shifts when AdSense
// injects its iframe. CLS is the metric ad-funded news sites fail most often.
const FORMATS: Record<AdFormat, { className: string; minHeight: number }> = {
  leaderboard: { className: "w-full", minHeight: 90 },
  rectangle: { className: "w-full max-w-[336px] mx-auto", minHeight: 280 },
  "in-article": { className: "w-full", minHeight: 250 },
  sidebar: { className: "w-full", minHeight: 600 },
};

export function AdSlot({
  format = "leaderboard",
  className,
}: {
  format?: AdFormat;
  className?: string;
}) {
  const { className: formatClass, minHeight } = FORMATS[format];
  const clientId = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

  return (
    <aside
      aria-label="Advertisement"
      className={cn("ad-slot", formatClass, className)}
      style={{ minHeight }}
    >
      {clientId ? (
        // Real slot. The AdSense script is loaded once in the site layout.
        <ins
          className="adsbygoogle block w-full"
          style={{ display: "block", minHeight }}
          data-ad-client={clientId}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      ) : (
        <span>Advertisement</span>
      )}
    </aside>
  );
}
