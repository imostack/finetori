import {
  pgTable,
  pgEnum,
  text,
  varchar,
  integer,
  real,
  boolean,
  timestamp,
  date,
  jsonb,
  uuid,
  index,
  uniqueIndex,
  primaryKey,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

/* ------------------------------------------------------------------ enums */

export const userRoleEnum = pgEnum("user_role", ["admin", "editor", "writer"]);

export const articleStatusEnum = pgEnum("article_status", [
  "draft",
  "in_review",
  "scheduled",
  "published",
  "archived",
]);

export const ingestedItemStatusEnum = pgEnum("ingested_item_status", [
  "new",
  "clustered",
  "drafted",
  "rejected",
]);

export const clusterStatusEnum = pgEnum("cluster_status", [
  "open",
  "drafted",
  "rejected",
  "failed",
]);

/* ------------------------------------------------------------------ users */

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 140 }).notNull(),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    role: userRoleEnum("role").notNull().default("writer"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("users_email_idx").on(t.email),
    uniqueIndex("users_slug_idx").on(t.slug),
  ],
);

/* ------------------------------------------------------------- categories */

// Self-referencing parentId gives the two-level taxonomy legit.ng uses
// (e.g. Business & Economy -> Energy).
export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 140 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
      onDelete: "set null",
    }),
    description: text("description"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("categories_slug_idx").on(t.slug),
    index("categories_parent_idx").on(t.parentId),
  ],
);

/* --------------------------------------------------------------- clusters */

// A cluster is one real-world event, evidenced by N ingested items from
// different outlets. Article generation happens per-cluster, not per-item.
export const clusters = pgTable(
  "clusters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    representativeTitle: text("representative_title").notNull(),
    score: real("score").notNull().default(0),
    itemCount: integer("item_count").notNull().default(0),
    status: clusterStatusEnum("status").notNull().default("open"),
    failureReason: text("failure_reason"),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("clusters_status_score_idx").on(t.status, t.score),
    index("clusters_last_seen_idx").on(t.lastSeenAt),
  ],
);

/* --------------------------------------------------------------- articles */

export type SourceAttribution = { name: string; url: string }[];

export const articles = pgTable(
  "articles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 220 }).notNull(),
    title: text("title").notNull(),
    dek: text("dek"),
    body: text("body").notNull().default(""),
    excerpt: text("excerpt"),

    coverImageUrl: text("cover_image_url"),
    coverCaption: text("cover_caption"),
    coverCredit: text("cover_credit"),

    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    authorId: uuid("author_id").references(() => users.id, {
      onDelete: "set null",
    }),

    status: articleStatusEnum("status").notNull().default("draft"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    scheduledFor: timestamp("scheduled_for", { withTimezone: true }),

    isBreaking: boolean("is_breaking").notNull().default(false),
    isFeatured: boolean("is_featured").notNull().default(false),

    seoTitle: text("seo_title"),
    seoDescription: text("seo_description"),

    // Provenance for AI-generated drafts.
    aiGenerated: boolean("ai_generated").notNull().default(false),
    aiModel: varchar("ai_model", { length: 60 }),
    sourceAttribution: jsonb("source_attribution").$type<SourceAttribution>(),
    clusterId: uuid("cluster_id").references(() => clusters.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("articles_slug_idx").on(t.slug),
    // Drives the homepage and every "latest" listing.
    index("articles_status_published_idx").on(t.status, t.publishedAt),
    index("articles_category_published_idx").on(t.categoryId, t.publishedAt),
    index("articles_author_published_idx").on(t.authorId, t.publishedAt),
    index("articles_status_scheduled_idx").on(t.status, t.scheduledFor),
  ],
);

/* ------------------------------------------------------------------- tags */

export const tags = pgTable(
  "tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: varchar("slug", { length: 140 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
  },
  (t) => [uniqueIndex("tags_slug_idx").on(t.slug)],
);

export const articleTags = pgTable(
  "article_tags",
  {
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.articleId, t.tagId] }),
    index("article_tags_tag_idx").on(t.tagId),
  ],
);

/* -------------------------------------------------------------- analytics */

// Daily rollup rather than a row per view: one upsert per request, and
// trending queries stay cheap as the archive grows.
export const articleViews = pgTable(
  "article_views",
  {
    articleId: uuid("article_id")
      .notNull()
      .references(() => articles.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.articleId, t.day] }),
    index("article_views_day_idx").on(t.day),
  ],
);

/* ---------------------------------------------------------------- sources */

export const sources = pgTable(
  "sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 160 }).notNull(),
    feedUrl: text("feed_url").notNull(),
    homepageUrl: text("homepage_url"),
    enabled: boolean("enabled").notNull().default(true),
    // Editorial weight applied to cluster scoring.
    trustWeight: real("trust_weight").notNull().default(1),
    lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("sources_feed_url_idx").on(t.feedUrl)],
);

export const ingestedItems = pgTable(
  "ingested_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    externalId: text("external_id"),
    url: text("url").notNull(),
    title: text("title").notNull(),
    summary: text("summary"),
    // Reference only — shown to the editor so they know what the story looks
    // like. Never used as an article cover; those images are licensed to the
    // originating outlet. See lib/ingest/README notes.
    imageUrl: text("image_url"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    // sha256 of canonical URL + normalized title; makes re-ingestion a no-op.
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
    clusterId: uuid("cluster_id").references(() => clusters.id, {
      onDelete: "set null",
    }),
    status: ingestedItemStatusEnum("status").notNull().default("new"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("ingested_items_hash_idx").on(t.contentHash),
    index("ingested_items_cluster_idx").on(t.clusterId),
    index("ingested_items_status_created_idx").on(t.status, t.createdAt),
  ],
);

/* ------------------------------------------------------------- newsletter */

export const newsletterSubscribers = pgTable(
  "newsletter_subscribers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
    unsubscribeToken: varchar("unsubscribe_token", { length: 64 }).notNull(),
    source: varchar("source", { length: 60 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("newsletter_email_idx").on(t.email),
    uniqueIndex("newsletter_token_idx").on(t.unsubscribeToken),
  ],
);

/* -------------------------------------------------------------- audit log */

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    action: varchar("action", { length: 60 }).notNull(),
    entity: varchar("entity", { length: 60 }).notNull(),
    entityId: uuid("entity_id"),
    meta: jsonb("meta").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_log_entity_idx").on(t.entity, t.entityId),
    index("audit_log_created_idx").on(t.createdAt),
  ],
);

/* -------------------------------------------------------------- relations */

export const usersRelations = relations(users, ({ many }) => ({
  articles: many(articles),
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  parent: one(categories, {
    fields: [categories.parentId],
    references: [categories.id],
    relationName: "category_parent",
  }),
  children: many(categories, { relationName: "category_parent" }),
  articles: many(articles),
}));

export const articlesRelations = relations(articles, ({ one, many }) => ({
  author: one(users, {
    fields: [articles.authorId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [articles.categoryId],
    references: [categories.id],
  }),
  cluster: one(clusters, {
    fields: [articles.clusterId],
    references: [clusters.id],
  }),
  articleTags: many(articleTags),
  views: many(articleViews),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  articleTags: many(articleTags),
}));

export const articleTagsRelations = relations(articleTags, ({ one }) => ({
  article: one(articles, {
    fields: [articleTags.articleId],
    references: [articles.id],
  }),
  tag: one(tags, {
    fields: [articleTags.tagId],
    references: [tags.id],
  }),
}));

export const articleViewsRelations = relations(articleViews, ({ one }) => ({
  article: one(articles, {
    fields: [articleViews.articleId],
    references: [articles.id],
  }),
}));

export const sourcesRelations = relations(sources, ({ many }) => ({
  items: many(ingestedItems),
}));

export const clustersRelations = relations(clusters, ({ many }) => ({
  items: many(ingestedItems),
  articles: many(articles),
}));

export const ingestedItemsRelations = relations(ingestedItems, ({ one }) => ({
  source: one(sources, {
    fields: [ingestedItems.sourceId],
    references: [sources.id],
  }),
  cluster: one(clusters, {
    fields: [ingestedItems.clusterId],
    references: [clusters.id],
  }),
}));

/* ------------------------------------------------------------------ types */

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type Article = typeof articles.$inferSelect;
export type NewArticle = typeof articles.$inferInsert;
export type Tag = typeof tags.$inferSelect;
export type Source = typeof sources.$inferSelect;
export type IngestedItem = typeof ingestedItems.$inferSelect;
export type Cluster = typeof clusters.$inferSelect;
export type UserRole = (typeof userRoleEnum.enumValues)[number];
export type ArticleStatus = (typeof articleStatusEnum.enumValues)[number];
