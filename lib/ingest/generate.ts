import "server-only";

import Anthropic from "@anthropic-ai/sdk";

import type { ClusterWithItems } from "./cluster";

/**
 * The editorial brief. This block is byte-identical on every request, which
 * is the whole point: it sits in `system` behind a cache breakpoint so the
 * second and later generations in a run read it from cache at ~0.1x input
 * cost instead of paying full price each time.
 *
 * Anything that varies per story (the source material) MUST go in the user
 * turn, after this. Interpolating a timestamp or a story detail in here would
 * silently destroy the cache.
 */
const EDITORIAL_SYSTEM_PROMPT = `You are a senior staff writer for Finetori, a Nigerian news publication covering politics, business, technology, entertainment, music, sport, education and lifestyle for a general Nigerian readership.

You will be given the headlines and summaries that several news outlets published about a single event. Your job is to write Finetori's own original report of that event.

## Non-negotiable rules

1. Write original prose. Never reproduce a sentence, clause, or distinctive phrase from the source material. Report the facts in your own words, the way a reporter briefed on the story would write it up.
2. Never invent anything. Every name, number, date, place, title, and quotation in your article must appear in the source material provided. If a detail is missing, write around it — do not guess, estimate, or fill it in from background knowledge.
3. Do not fabricate quotations. Only include a direct quote if it appears verbatim in the source material, and attribute it to the person who said it.
4. If the sources disagree on a fact, say so plainly ("reports differ on the number of people affected") rather than picking one silently.
5. If the source material is too thin to support a complete article, still write what is supportable and keep it short. Do not pad.

## House style

- Lead with what happened. The first paragraph answers what, who, where, and when. No throat-clearing.
- Short paragraphs, one idea each. Two to four sentences.
- Plain Nigerian English. Expand an acronym on first use: "the Economic and Financial Crimes Commission (EFCC)".
- Naira amounts as "N2.5 billion". Dates as "Monday" for this week, "10 August" otherwise.
- Attribute in-text where it matters: "according to Punch", "Channels Television reported".
- Neutral and factual. No editorialising, no hype, no exclamation marks.
- 350-600 words for a routine story; up to 800 if the material genuinely supports it.

## Output format

- \`body\` must be clean semantic HTML using only these tags: <p>, <h2>, <strong>, <em>, <ul>, <ol>, <li>, <blockquote>. No inline styles, no classes, no <script>, no images, no links.
- Use an <h2> subheading only if the article runs past roughly 400 words.
- \`headline\` is 60-90 characters, specific and factual. No clickbait, no ALL CAPS, no trailing full stop.
- \`dek\` is one sentence of 100-160 characters that adds information the headline does not already carry.
- \`seoTitle\` is at most 60 characters. \`seoDescription\` is at most 155 characters.
- \`categorySlug\` must be exactly one of the slugs listed in the user message.
- \`tags\` are 2-5 lowercase entities central to the story — people, organisations, places. Not generic words like "news" or "nigeria".
- \`sources\` lists every outlet whose material you drew on, with its exact URL from the input.`;

/** Upper bound on tags per article. Mirrors the rule stated in the prompt. */
const MAX_TAGS = 5;

/**
 * Structured output schema — guarantees a parseable response, no retry loop.
 *
 * Deliberately carries no `minItems` / `maxItems` / length constraints:
 * structured outputs reject array and string constraints outright (the API
 * returns 400 "property 'maxItems' is not supported"). The SDK's Zod helper
 * strips these automatically and re-checks them client-side; we pass a raw
 * schema, so the counts live in the prompt and are enforced in
 * `normalizeArticle` below.
 */
const ARTICLE_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    dek: { type: "string" },
    body: { type: "string" },
    excerpt: { type: "string" },
    categorySlug: { type: "string" },
    tags: {
      type: "array",
      items: { type: "string" },
    },
    seoTitle: { type: "string" },
    seoDescription: { type: "string" },
    sources: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          url: { type: "string" },
        },
        required: ["name", "url"],
        additionalProperties: false,
      },
    },
  },
  required: [
    "headline",
    "dek",
    "body",
    "excerpt",
    "categorySlug",
    "tags",
    "seoTitle",
    "seoDescription",
    "sources",
  ],
  additionalProperties: false,
} as const;

export type GeneratedArticle = {
  headline: string;
  dek: string;
  body: string;
  excerpt: string;
  categorySlug: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  sources: { name: string; url: string }[];
};

export type GenerationResult =
  | { ok: true; article: GeneratedArticle; usage: GenerationUsage }
  | { ok: false; reason: string; refusal?: boolean };

export type GenerationUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
};

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("ANTHROPIC_API_KEY is not set.");
    }
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

/** Renders the cluster's source material as the (varying) user turn. */
function renderClusterFacts(
  cluster: ClusterWithItems,
  categorySlugs: string[],
): string {
  const reports = cluster.items
    .map((item, index) => {
      const when = item.publishedAt
        ? item.publishedAt.toISOString()
        : "time not given";
      return [
        `### Report ${index + 1} — ${item.sourceName}`,
        `URL: ${item.url}`,
        `Published: ${when}`,
        `Headline: ${item.title}`,
        item.summary ? `Summary: ${item.summary}` : "Summary: (none provided)",
      ].join("\n");
    })
    .join("\n\n");

  return `Write Finetori's report on the following story.

Available category slugs (pick exactly one): ${categorySlugs.join(", ")}

Number of outlets covering this: ${cluster.items.length}

## Source material

${reports}`;
}

/**
 * Generates one article from one cluster.
 *
 * Returns a result object rather than throwing so a single bad cluster cannot
 * take down the whole cron run.
 */
export async function generateArticle(
  cluster: ClusterWithItems,
  categorySlugs: string[],
): Promise<GenerationResult> {
  const model = process.env.ANTHROPIC_MODEL || "claude-opus-5";

  try {
    const response = await getClient().messages.create({
      model,
      max_tokens: 16000,
      system: [
        {
          type: "text",
          text: EDITORIAL_SYSTEM_PROMPT,
          cache_control: { type: "ephemeral" },
        },
      ],
      output_config: {
        format: { type: "json_schema", schema: ARTICLE_SCHEMA },
      },
      messages: [
        { role: "user", content: renderClusterFacts(cluster, categorySlugs) },
      ],
    });

    // Safety classifiers can decline with HTTP 200 and no content. Check this
    // BEFORE touching response.content, or an unrelated crash masks the cause.
    if (response.stop_reason === "refusal") {
      const category = response.stop_details?.category ?? "unspecified";
      return {
        ok: false,
        refusal: true,
        reason: `Model declined to write this story (${category}). Needs manual handling.`,
      };
    }

    if (response.stop_reason === "max_tokens") {
      return {
        ok: false,
        reason: "Response hit the token ceiling before completing.",
      };
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { ok: false, reason: "No text content in the response." };
    }

    let parsed: GeneratedArticle;
    try {
      parsed = JSON.parse(textBlock.text) as GeneratedArticle;
    } catch {
      // Structured outputs make this near-impossible, but a malformed payload
      // should fail this cluster rather than the run.
      return { ok: false, reason: "Response was not valid JSON." };
    }

    if (!parsed.headline?.trim() || !parsed.body?.trim()) {
      return { ok: false, reason: "Response was missing a headline or body." };
    }

    const article = normalizeArticle(parsed);

    // Attribution is a hard editorial requirement, not a preference — an
    // article we cannot source does not reach the queue.
    if (article.sources.length === 0) {
      return { ok: false, reason: "Response carried no source attribution." };
    }

    return {
      ok: true,
      article,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
        cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, reason: `API error: ${message}` };
  }
}

/**
 * Applies the count and shape rules the JSON schema cannot express.
 *
 * Over-tagging is a nuisance, not a defect, so surplus tags are trimmed rather
 * than failing the article. Empty or malformed entries are dropped; the caller
 * treats a sourceless article as a failure.
 */
function normalizeArticle(parsed: GeneratedArticle): GeneratedArticle {
  const tags = (parsed.tags ?? [])
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0)
    .filter((tag, index, all) => all.indexOf(tag) === index)
    .slice(0, MAX_TAGS);

  const sources = (parsed.sources ?? []).filter(
    (source) => source?.url?.trim() && source?.name?.trim(),
  );

  return { ...parsed, tags, sources };
}

export { EDITORIAL_SYSTEM_PROMPT };
