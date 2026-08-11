# Finetori

A Nigerian news platform — public site plus a newsroom admin, with a
self-updating pipeline that drafts articles from breaking news and queues them
for editor approval.

Built with Next.js 16 (App Router), TypeScript, Tailwind CSS v4, Postgres via
Drizzle, and the Claude API.

---

## Quick start

```bash
npm install
cp .env.example .env.local     # then fill in the values below
npm run db:push                # create the schema
npm run db:seed                # admin user, categories, starter feeds
npm run dev
```

Public site: <http://localhost:3000> · Newsroom: <http://localhost:3000/admin>

The seed prints the admin credentials it created. **Change that password after
the first login.**

### Required environment variables

| Variable | Needed for | Notes |
|---|---|---|
| `DATABASE_URL` | Everything | Neon: use the **pooled** string (host contains `-pooler`) |
| `AUTH_SECRET` | Signing session cookies | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `CRON_SECRET` | Protecting `/api/cron/*` | Same generator. Routes fail closed if unset |
| `ANTHROPIC_API_KEY` | Article generation | Only needed to run ingestion |
| `BLOB_READ_WRITE_TOKEN` | Image uploads | Vercel dashboard → Storage → Blob |
| `NEXT_PUBLIC_SITE_URL` | Canonical URLs, sitemaps | No trailing slash |
| `NEXT_PUBLIC_ADSENSE_CLIENT_ID` | Serving ads | Leave empty until approved; slots render as reserved space |

---

## How the news pipeline works

`/api/cron/ingest` runs hourly on Vercel Cron. One pass:

1. **Fetch** — every enabled feed in `sources`, in parallel. A failing feed
   records its error and is skipped; it never aborts the run.
2. **Dedupe** — canonical URL + normalized title → sha256. A unique index makes
   re-ingesting the same story a no-op.
3. **Cluster** — items from the last 24h are grouped by Jaccard similarity over
   significant title tokens. One cluster ≈ one real event. New items also
   merge into open clusters from earlier runs, so a story Punch breaks at
   10:00 and Vanguard picks up at 11:00 stays one event.
4. **Score** — `distinctSources × avgTrustWeight × recencyDecay` (~8h half-life).
   Corroboration and freshness both count, which is what "trending" means.
5. **Generate** — top N clusters go to Claude with a structured-output schema.
   The editorial brief lives in `system` behind a cache breakpoint; the varying
   source material goes in the user turn.
6. **Queue** — drafts are inserted as `in_review`. **Nothing is ever
   auto-published.**

Tune volume with `INGEST_MAX_DRAFTS_PER_RUN` (default 10).

### Trigger a run manually

```bash
curl -X POST "http://localhost:3000/api/cron/ingest?max=3" \
  -H "Authorization: Bearer $CRON_SECRET"
```

Returns a JSON report: items fetched, clusters created, drafts made, per-cluster
failures, and token usage.

### Tuning the clustering threshold

`SIMILARITY_THRESHOLD` in `lib/ingest/cluster.ts` is calibrated against a real
181-item sample across the eight seeded outlets. It sits at **0.25**, not the
obvious-looking 0.4+: at 0.42 *every* cross-outlet pair scoring 0.25–0.42 was a
true match being missed, splitting one story into several single-source
clusters and destroying the corroboration signal scoring depends on. Below
about 0.20 real false positives appear.

Generic newsroom vocabulary ("troops", "recover", "weapons", "arrest") is in
the stopword list for the same reason — those words matched an Enugu arrest to
an ISWAP raid in Borno. Removing them is what lets the threshold come down
safely.

If you change the source mix substantially, re-check the calibration:

```bash
npx tsx --env-file=.env.local scripts/threshold-check.ts   # near-miss pairs
npx tsx --env-file=.env.local scripts/recluster-test.ts reset
curl -X POST "http://localhost:3000/api/cron/ingest?max=0" -H "Authorization: Bearer $CRON_SECRET"
npx tsx --env-file=.env.local scripts/recluster-test.ts report
```

Current numbers on the sample: 165 clusters over 186 items, 17 multi-source.

### Feed quality

Not every outlet emits well-formed XML. `lib/ingest/fetch.ts` retries once
against sanitized XML (comments stripped, bare `&` escaped, illegal control
characters removed, CDATA left untouched). Channels Television's feed has
defects beyond that and currently fails every run — its error is visible in
**Admin → News sources**, and the other seven feeds are unaffected. Disable it
there if the noise bothers you.

### Structured-output schema constraints

`ARTICLE_SCHEMA` in `lib/ingest/generate.ts` deliberately carries no
`minItems` / `maxItems` / length constraints. Structured outputs reject array
and string constraints outright — the API returns
`400 output_config.format.schema: For 'array' type, property 'maxItems' is not
supported`. The SDK's Zod helper strips these and re-validates client-side; we
pass a raw JSON schema, so the counts live in the prompt and are enforced in
`normalizeArticle()`. **Don't add constraints back to that schema** — it fails
at request time, not at build time.

### What a draft actually costs

Measured on a real run (Sonnet 5, one article synthesised from two outlets):

| | tokens |
|---|---|
| Input, uncached | 497 |
| Input, cached system prompt | 1,452 |
| Output | 661 |

At one draft/day the 5-minute cache TTL always expires between runs, so every
call is cold: ~1,950 input + ~660 output. On Sonnet 5 that is about **$0.01 per
draft — roughly 30¢/month**, or ~50¢ once the introductory pricing ends on
2026-08-31. Opus 5 is about 4× that and still under $2/month at this volume.

Caching only starts paying once several drafts are generated inside one run.

### Switching models

`ANTHROPIC_MODEL` selects the writer. `claude-opus-5` is the default;
`claude-sonnet-5` is materially cheaper at volume. Changing it is a one-line env
change, so A/B them on real clusters before committing.

### Watching prompt-cache effectiveness

The ingest report includes `usage.cacheReadTokens`. On a run that generates more
than one article this should be well above zero — the editorial brief is
identical every call. If it stays at zero, something is varying inside the
`system` block and every request is paying full input price.

---

## Editorial guardrails

These are enforced in code, not left to policy:

- **A cover image is required to publish.** Source photographs belong to the
  outlets that took them. The pipeline stores the original outlet's image only
  as an on-screen reference for the editor, clearly labelled; publishing is
  blocked until someone attaches an image we own or have licensed.
- **A byline and a section are required to publish.** No anonymous or
  unfiled stories.
- **Attribution is preserved and rendered.** Generated source URLs are
  intersected against the cluster's real items, so a hallucinated link cannot
  reach the attribution block.
- **All body HTML is sanitized on save** (`lib/sanitize.ts`) — from the editor
  and from the model alike.
- **Every publish, reject, and schedule writes an `audit_log` row.**

The prompt itself forbids reproducing source sentences and inventing quotes,
figures, or names. See `lib/ingest/generate.ts`.

---

## Project layout

```
app/
├── (site)/              public site — shares header/footer/ads
│   ├── page.tsx                 homepage
│   ├── [category]/              section index
│   ├── [category]/[slug]/       article
│   ├── author/[slug]/  tag/[slug]/  search/
│   └── (legal)/                 about, contact, privacy, terms, editorial policy
├── admin/
│   ├── login/                   outside the dashboard chrome
│   └── (dashboard)/             queue, posts, categories, sources, team, newsletter
├── api/
│   ├── cron/ingest              hourly pipeline
│   ├── cron/publish-scheduled   every 5 min
│   ├── views/[id]  newsletter/  upload/
└── sitemap.ts · robots.ts · rss.xml · news-sitemap.xml
db/          schema.ts, client, migrations
lib/         auth, queries, publish, sanitize, utils, site, ingest/
components/  site/ and admin/
scripts/     seed.ts
```

### Notable Next.js 16 specifics

This project targets Next 16, which differs from 15 in ways that matter here:

- `middleware.ts` is now **`proxy.ts`**, exporting `proxy`, Node runtime only.
- `params` and `searchParams` are **Promises** — always `await` them.
- Route types (`PageProps<'/x'>`, `LayoutProps`, `RouteContext`) are generated
  by `npx next typegen`; run it after adding a route if your editor complains.
- `revalidateTag` requires a cache-profile second argument. This codebase uses
  `revalidatePath`, whose signature is unchanged.

---

## Auth model

Session = signed JWT (`jose`, HS256) in an httpOnly cookie. Passwords are
bcrypt, cost 12.

Roles are a strict hierarchy — `writer` < `editor` < `admin`:

| | Writer | Editor | Admin |
|---|:-:|:-:|:-:|
| Draft and edit own articles | ✓ | ✓ | ✓ |
| Edit anyone's article | | ✓ | ✓ |
| Publish, schedule, review queue | | ✓ | ✓ |
| Manage sources and the team | | | ✓ |

`proxy.ts` redirects anonymous traffic away from `/admin`, but that is a
convenience. **The authorization boundary is `requireUser()` in `lib/auth.ts`**,
called inside each page, action, and route handler next to the data access.

---

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Dev server (Turbopack) |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:push` | Push schema without a migration file (dev) |
| `npm run db:generate` / `db:migrate` | Versioned migrations (production) |
| `npm run db:studio` | Drizzle Studio |
| `npm run db:seed` | Idempotent seed |

---

## Deploying

1. Push to GitHub, import into Vercel.
2. Set every variable from the table above in Vercel's project settings, with
   `NEXT_PUBLIC_SITE_URL` set to the real domain.
3. Create a Vercel Blob store; `BLOB_READ_WRITE_TOKEN` is injected automatically.
4. `vercel.json` already registers both cron jobs — Vercel sends `CRON_SECRET`
   as a Bearer token.
5. Run `npm run db:migrate` against the production database.
6. **Verify on the Vercel preview URL before touching DNS.** finetori.com stays
   on WordPress until then.
7. Cut DNS over. The four "Hello World" WordPress posts need no migration.

### After launch

- Submit `sitemap.xml` and `news-sitemap.xml` in Google Search Console.
- Apply to Google News Publisher Center once there is a real publishing record.
- Apply for AdSense — it needs genuine content plus the About, Contact and
  Privacy pages, which are already built.

---

## Things deliberately left open

- **Newsletter sending.** Capture, storage and CSV export work. Delivery is not
  wired — Resend is the easiest addition.
- **Comments.** Not built. Moderation is a real operational cost; worth a
  separate decision.
- **Batch API for ingestion.** At 10 articles/hour the inline path is fine.
  Anthropic's Batches API halves token cost and would suit a much higher volume,
  at the price of a second polling cron.
- **Embedding-based clustering.** Title similarity is cheap and legible. If
  precision degrades, swap `lib/ingest/cluster.ts` for pgvector — nothing else
  in the pipeline changes.
