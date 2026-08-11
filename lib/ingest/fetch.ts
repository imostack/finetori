import "server-only";

import crypto from "node:crypto";
import Parser from "rss-parser";
import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { ingestedItems, sources, type Source } from "@/db/schema";

export type NormalizedItem = {
  sourceId: string;
  externalId: string | null;
  url: string;
  title: string;
  summary: string | null;
  imageUrl: string | null;
  publishedAt: Date | null;
  contentHash: string;
};

const parser = new Parser({
  timeout: 15_000,
  headers: { "User-Agent": "FinetoriBot/1.0 (+https://finetori.com)" },
  customFields: {
    item: [
      ["media:content", "mediaContent", { keepArray: false }],
      ["media:thumbnail", "mediaThumbnail", { keepArray: false }],
    ],
  },
});

/**
 * Strips tracking parameters and normalizes the URL so the same story linked
 * from two places produces one hash rather than two.
 */
export function canonicalizeUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = "";
    const strip = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
      "ref",
      "amp",
    ];
    for (const key of strip) url.searchParams.delete(key);
    url.protocol = "https:";
    url.hostname = url.hostname.replace(/^www\./, "").toLowerCase();
    return url.toString().replace(/\/$/, "");
  } catch {
    return raw.trim();
  }
}

/** Lowercase, punctuation-free title used for hashing and similarity. */
export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[‘’“”]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashItem(url: string, title: string): string {
  return crypto
    .createHash("sha256")
    .update(`${canonicalizeUrl(url)}::${normalizeTitle(title)}`)
    .digest("hex");
}

/** Pulls the best available image reference out of a feed entry. */
function extractImage(item: Record<string, unknown>): string | null {
  const media = item.mediaContent as { $?: { url?: string } } | undefined;
  if (media?.$?.url) return media.$.url;

  const thumb = item.mediaThumbnail as { $?: { url?: string } } | undefined;
  if (thumb?.$?.url) return thumb.$.url;

  const enclosure = item.enclosure as { url?: string; type?: string } | undefined;
  if (enclosure?.url && enclosure.type?.startsWith("image/")) {
    return enclosure.url;
  }

  const content = (item["content:encoded"] ?? item.content) as
    | string
    | undefined;
  return content ? firstImageSrc(content) : null;
}

/**
 * Pulls the first <img src> out of a chunk of feed HTML.
 *
 * Done as two linear scans rather than one regex: a pattern like
 * /<img[^>]+src=["']([^"']+)["']/ backtracks catastrophically on hostile
 * input, and feed bodies are untrusted third-party HTML.
 */
function firstImageSrc(html: string): string | null {
  const start = html.toLowerCase().indexOf("<img");
  if (start === -1) return null;

  const end = html.indexOf(">", start);
  const tag = html.slice(start, end === -1 ? start + 500 : end);

  const srcMatch = /\ssrc\s*=\s*("([^"]*)"|'([^']*)')/i.exec(tag);
  const value = srcMatch?.[2] ?? srcMatch?.[3];
  return value?.trim() || null;
}

function stripHtml(value: string | undefined): string | null {
  if (!value) return null;
  const text = value
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 0 ? text.slice(0, 1200) : null;
}

/**
 * Parses a feed, retrying once on sanitized XML.
 *
 * Real newsroom feeds are not always well-formed — Channels Television, for
 * one, emits malformed comments that make a strict parser bail. Rather than
 * lose a major outlet every hour, strip the constructs that break parsing and
 * try again.
 */
async function parseFeed(feedUrl: string) {
  try {
    return await parser.parseURL(feedUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Only worth retrying for XML well-formedness errors, not network faults.
    if (!/malformed|invalid character|unexpected close|not well-formed/i.test(message)) {
      throw error;
    }

    const response = await fetch(feedUrl, {
      headers: { "User-Agent": "FinetoriBot/1.0 (+https://finetori.com)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw error;

    return await parser.parseString(sanitizeXml(await response.text()));
  }
}

/** Matches an `&` that does not begin a valid entity reference. */
const BARE_AMPERSAND =
  /&(?!(?:[a-zA-Z][a-zA-Z0-9]{0,30}|#\d{1,7}|#x[0-9a-fA-F]{1,6});)/g;

/**
 * Repairs the three things that most often make a real-world feed
 * unparseable: XML comments containing a stray "--", bare ampersands (an
 * unescaped "&" in a query string is the usual culprit), and control
 * characters XML 1.0 forbids outright.
 *
 * Walks the string once with indexOf rather than using regexes to locate
 * regions. A lazy `<!--[\s\S]*?-->` rescans to end-of-string for every
 * unclosed `<!--`, which is quadratic on exactly the malformed input this
 * function exists to handle.
 *
 * CDATA sections pass through untouched — "&" is legal inside one, and
 * escaping it would corrupt the article text rather than repair the feed.
 */
function sanitizeXml(xml: string): string {
  const parts: string[] = [];
  let cursor = 0;

  while (cursor < xml.length) {
    const comment = xml.indexOf("<!--", cursor);
    const cdata = xml.indexOf("<![CDATA[", cursor);

    // Whichever construct comes first, if either.
    let next: number;
    if (comment === -1) next = cdata;
    else if (cdata === -1) next = comment;
    else next = Math.min(comment, cdata);

    if (next === -1) {
      parts.push(xml.slice(cursor).replace(BARE_AMPERSAND, "&amp;"));
      break;
    }

    parts.push(xml.slice(cursor, next).replace(BARE_AMPERSAND, "&amp;"));

    if (next === cdata) {
      const close = xml.indexOf("]]>", next);
      if (close === -1) {
        parts.push(xml.slice(next)); // unterminated — keep verbatim
        break;
      }
      parts.push(xml.slice(next, close + 3)); // verbatim, "&" included
      cursor = close + 3;
    } else {
      const close = xml.indexOf("-->", next + 4);
      if (close === -1) break; // unterminated comment — drop the remainder
      cursor = close + 3; // drop the comment entirely
    }
  }

  // Strip control characters that XML 1.0 forbids, by codepoint.
  // eslint-disable-next-line no-control-regex
  return parts.join("").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

/** Fetches and normalizes one feed. Never throws — records the error instead. */
async function fetchSource(source: Source): Promise<NormalizedItem[]> {
  try {
    const feed = await parseFeed(source.feedUrl);

    const items = (feed.items ?? [])
      .filter((item) => item.link && item.title)
      .map((item) => {
        const url = canonicalizeUrl(item.link!);
        const title = item.title!.trim();
        const published = item.isoDate ?? item.pubDate;

        return {
          sourceId: source.id,
          externalId: item.guid ?? null,
          url,
          title,
          summary: stripHtml(item.contentSnippet ?? item.content),
          imageUrl: extractImage(item as unknown as Record<string, unknown>),
          publishedAt: published ? new Date(published) : null,
          contentHash: hashItem(url, title),
        } satisfies NormalizedItem;
      });

    await db
      .update(sources)
      .set({ lastFetchedAt: new Date(), lastError: null })
      .where(eq(sources.id, source.id));

    return items;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[ingest] ${source.name} failed: ${message}`);
    await db
      .update(sources)
      .set({ lastFetchedAt: new Date(), lastError: message.slice(0, 500) })
      .where(eq(sources.id, source.id));
    return [];
  }
}

/**
 * Fetches every enabled source in parallel and inserts the items we have not
 * seen before. Returns the number of genuinely new items.
 */
export async function fetchAndStoreItems(): Promise<{
  fetched: number;
  inserted: number;
  sourceCount: number;
}> {
  const enabled = await db
    .select()
    .from(sources)
    .where(eq(sources.enabled, true));

  if (enabled.length === 0) {
    return { fetched: 0, inserted: 0, sourceCount: 0 };
  }

  const batches = await Promise.all(enabled.map(fetchSource));
  const all = batches.flat();

  // Two different feeds can carry the same story; de-dupe within this run
  // before touching the database.
  const byHash = new Map<string, NormalizedItem>();
  for (const item of all) {
    if (!byHash.has(item.contentHash)) byHash.set(item.contentHash, item);
  }
  const unique = [...byHash.values()];
  if (unique.length === 0) {
    return { fetched: 0, inserted: 0, sourceCount: enabled.length };
  }

  // Skip anything already stored. The unique index would reject duplicates
  // anyway, but filtering first keeps the insert small.
  const existing = await db
    .select({ contentHash: ingestedItems.contentHash })
    .from(ingestedItems)
    .where(
      inArray(
        ingestedItems.contentHash,
        unique.map((i) => i.contentHash),
      ),
    );
  const seen = new Set(existing.map((e) => e.contentHash));
  const fresh = unique.filter((i) => !seen.has(i.contentHash));

  if (fresh.length > 0) {
    await db.insert(ingestedItems).values(fresh).onConflictDoNothing();
  }

  return {
    fetched: all.length,
    inserted: fresh.length,
    sourceCount: enabled.length,
  };
}
