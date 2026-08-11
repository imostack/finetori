import slugifyLib from "slugify";

/** URL-safe slug. Deterministic, so the same title always yields the same slug. */
export function slugify(input: string): string {
  return slugifyLib(input, {
    lower: true,
    strict: true,
    trim: true,
    locale: "en",
  }).slice(0, 200);
}

/**
 * Appends a short suffix so a slug can be retried on unique-constraint
 * collision (two stories the same day about the same subject).
 */
export function slugWithSuffix(base: string, suffix: string | number): string {
  return `${base.slice(0, 190)}-${suffix}`;
}

/** "3 minutes ago" / "2 hours ago" — the timestamp style news sites use. */
export function relativeTime(date: Date | string | number): string {
  const then = new Date(date).getTime();
  const seconds = Math.round((Date.now() - then) / 1000);

  if (seconds < 45) return "just now";
  if (seconds < 90) return "a minute ago";

  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["minute", 60],
    ["hour", 3600],
    ["day", 86400],
    ["week", 604800],
    ["month", 2592000],
    ["year", 31536000],
  ];

  // Walk from the largest unit down and take the first that fits.
  let unit: Intl.RelativeTimeFormatUnit = "minute";
  let divisor = 60;
  for (let i = units.length - 1; i >= 0; i--) {
    if (seconds >= units[i][1]) {
      [unit, divisor] = units[i];
      break;
    }
  }

  const value = Math.round(seconds / divisor);
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
    -value,
    unit,
  );
}

/** Longer form for article bylines: "10 August 2026, 3:41 PM". */
export function formatDateTime(date: Date | string | number): string {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
  }).format(new Date(date));
}

export function formatDate(date: Date | string | number): string {
  return new Intl.DateTimeFormat("en-NG", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Lagos",
  }).format(new Date(date));
}

/** Strips HTML and truncates on a word boundary — for excerpts and meta tags. */
export function plainExcerpt(html: string, maxLength = 200): string {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Rough reading time; 200wpm is the usual newsroom assumption. */
export function readingTimeMinutes(html: string): number {
  const words = plainExcerpt(html, Number.MAX_SAFE_INTEGER).split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}

/** Joins conditional class names. */
export function cn(
  ...values: (string | false | null | undefined)[]
): string {
  return values.filter(Boolean).join(" ");
}
