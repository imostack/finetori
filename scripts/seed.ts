/**
 * Seeds the newsroom with the taxonomy, an initial admin, and a starter set of
 * Nigerian news feeds. Idempotent — safe to re-run.
 *
 *   npm run db:seed
 */
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

import { db, sql } from "@/db";
import { categories, sources, users } from "@/db/schema";
import { slugify } from "@/lib/utils";

/* --------------------------------------------------------------- taxonomy */

// Mirrors the sections finetori.com already advertises, plus the sub-category
// depth legit.ng uses for Business and Sports.
const TAXONOMY: {
  name: string;
  description: string;
  children?: string[];
}[] = [
  {
    name: "News",
    description: "Breaking news and top stories from across Nigeria.",
    children: ["Nigeria", "World", "Metro"],
  },
  {
    name: "Politics",
    description: "Government, elections, policy and political affairs.",
  },
  {
    name: "Business",
    description: "Economy, markets, money and industry.",
    children: ["Economy", "Money", "Energy", "Capital Market"],
  },
  {
    name: "Technology",
    description: "Startups, gadgets, fintech and the digital economy.",
  },
  {
    name: "Entertainment",
    description: "Nollywood, celebrities, film and television.",
  },
  { name: "Music", description: "Afrobeats, releases, charts and artists." },
  {
    name: "Sports",
    description: "Football, athletics, boxing and more.",
    children: ["Football", "Athletics", "Boxing"],
  },
  {
    name: "Education",
    description: "Schools, admissions, scholarships and academic news.",
  },
  {
    name: "Lifestyle",
    description: "Health, fashion, relationships and culture.",
  },
];

/* ------------------------------------------------------------ news feeds */

// Starter set. Curate these in /admin/sources once you see output quality.
// trustWeight biases cluster scoring toward outlets you rate highly.
const FEEDS: {
  name: string;
  feedUrl: string;
  homepageUrl: string;
  trustWeight: number;
}[] = [
  {
    name: "Punch",
    feedUrl: "https://punchng.com/feed/",
    homepageUrl: "https://punchng.com",
    trustWeight: 1.2,
  },
  {
    name: "Vanguard",
    feedUrl: "https://www.vanguardngr.com/feed/",
    homepageUrl: "https://www.vanguardngr.com",
    trustWeight: 1.1,
  },
  {
    name: "The Cable",
    feedUrl: "https://www.thecable.ng/feed",
    homepageUrl: "https://www.thecable.ng",
    trustWeight: 1.2,
  },
  {
    name: "Premium Times",
    feedUrl: "https://www.premiumtimesng.com/feed",
    homepageUrl: "https://www.premiumtimesng.com",
    trustWeight: 1.3,
  },
  {
    name: "Channels Television",
    feedUrl: "https://www.channelstv.com/feed/",
    homepageUrl: "https://www.channelstv.com",
    trustWeight: 1.2,
  },
  {
    name: "Nairametrics",
    feedUrl: "https://nairametrics.com/feed/",
    homepageUrl: "https://nairametrics.com",
    trustWeight: 1.1,
  },
  {
    name: "Legit.ng",
    feedUrl: "https://www.legit.ng/rss/all.rss",
    homepageUrl: "https://www.legit.ng",
    trustWeight: 0.9,
  },
  {
    name: "BBC News Africa",
    feedUrl: "https://feeds.bbci.co.uk/news/world/africa/rss.xml",
    homepageUrl: "https://www.bbc.com/news/world/africa",
    trustWeight: 1.3,
  },
];

/* ------------------------------------------------------------------ main */

async function main() {
  console.log("Seeding Finetori…\n");

  /* ---- admin user ---- */
  const adminEmail = (process.env.SEED_ADMIN_EMAIL || "admin@finetori.com")
    .trim()
    .toLowerCase();
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "changeme123";
  const adminName = process.env.SEED_ADMIN_NAME || "Finetori Admin";

  const existingAdmin = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);

  if (existingAdmin.length > 0) {
    console.log(`  user      ${adminEmail} (exists, unchanged)`);
  } else {
    await db.insert(users).values({
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      name: adminName,
      slug: slugify(adminName),
      role: "admin",
      bio: "Editorial desk.",
    });
    console.log(`  user      ${adminEmail}`);
    if (!process.env.SEED_ADMIN_PASSWORD) {
      console.log(
        `            password: ${adminPassword}  <-- CHANGE THIS AFTER FIRST LOGIN`,
      );
    }
  }

  /* ---- categories ---- */
  let categoryCount = 0;
  let order = 0;

  for (const entry of TAXONOMY) {
    const slug = slugify(entry.name);
    order += 10;

    const existing = await db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.slug, slug))
      .limit(1);

    let parentId: string;
    if (existing.length > 0) {
      parentId = existing[0].id;
    } else {
      const [row] = await db
        .insert(categories)
        .values({
          slug,
          name: entry.name,
          description: entry.description,
          sortOrder: order,
        })
        .returning({ id: categories.id });
      parentId = row.id;
      categoryCount++;
    }

    let childOrder = 0;
    for (const childName of entry.children ?? []) {
      const childSlug = slugify(childName);
      childOrder += 10;

      const childExists = await db
        .select({ id: categories.id })
        .from(categories)
        .where(eq(categories.slug, childSlug))
        .limit(1);

      if (childExists.length === 0) {
        await db.insert(categories).values({
          slug: childSlug,
          name: childName,
          parentId,
          sortOrder: childOrder,
        });
        categoryCount++;
      }
    }
  }
  console.log(`  category  ${categoryCount} new`);

  /* ---- sources ---- */
  let sourceCount = 0;
  for (const feed of FEEDS) {
    const existing = await db
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.feedUrl, feed.feedUrl))
      .limit(1);

    if (existing.length === 0) {
      await db.insert(sources).values(feed);
      sourceCount++;
    }
  }
  console.log(`  source    ${sourceCount} new`);

  console.log("\nDone. Sign in at /admin/login");
}

main()
  .catch((err) => {
    console.error("\nSeed failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sql.end();
  });
