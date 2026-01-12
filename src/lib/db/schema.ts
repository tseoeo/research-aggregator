import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  serial,
  jsonb,
  primaryKey,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ============================================
// PAPER SOURCES (extensible)
// ============================================

export const paperSources = pgTable("paper_sources", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(), // 'arxiv', 'pubmed', etc.
  baseUrl: text("base_url").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// PAPERS
// ============================================

export const papers = pgTable(
  "papers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => paperSources.id),
    externalId: varchar("external_id", { length: 255 }).notNull(), // arXiv ID, DOI, etc.
    title: text("title").notNull(),
    abstract: text("abstract"),
    publishedAt: timestamp("published_at"),
    updatedAt: timestamp("updated_at"),
    pdfUrl: text("pdf_url"),
    categories: text("categories").array(), // ['cs.AI', 'cs.LG']
    primaryCategory: varchar("primary_category", { length: 50 }),

    // AI Summary (populated by job)
    summaryBullets: text("summary_bullets").array(), // 3 bullet points
    summaryEli5: text("summary_eli5"),
    summaryGeneratedAt: timestamp("summary_generated_at"),
    summaryModel: varchar("summary_model", { length: 100 }),

    // Metadata
    createdAt: timestamp("created_at").defaultNow(),
    fetchedAt: timestamp("fetched_at").defaultNow(),
  },
  (table) => [unique("papers_source_external").on(table.sourceId, table.externalId)]
);

export const papersRelations = relations(papers, ({ one, many }) => ({
  source: one(paperSources, {
    fields: [papers.sourceId],
    references: [paperSources.id],
  }),
  paperAuthors: many(paperAuthors),
  socialMentions: many(socialMentions),
  newsMentions: many(newsMentions),
}));

// ============================================
// AUTHORS
// ============================================

export const authors = pgTable("authors", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  normalizedName: varchar("normalized_name", { length: 255 }), // lowercase, no accents

  // External identifiers
  orcid: varchar("orcid", { length: 50 }).unique(),
  openalexId: varchar("openalex_id", { length: 100 }),
  semanticScholarId: varchar("semantic_scholar_id", { length: 100 }),
  googleScholarId: varchar("google_scholar_id", { length: 100 }),

  // Social media handles (discovered)
  twitterHandle: varchar("twitter_handle", { length: 100 }),
  blueskyHandle: varchar("bluesky_handle", { length: 100 }),
  githubHandle: varchar("github_handle", { length: 100 }),
  linkedinUrl: text("linkedin_url"),
  personalWebsite: text("personal_website"),

  // Discovery metadata
  socialDiscoveryStatus: varchar("social_discovery_status", { length: 50 }).default(
    "pending"
  ), // pending, in_progress, completed, failed
  socialDiscoveryAt: timestamp("social_discovery_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const authorsRelations = relations(authors, ({ many }) => ({
  paperAuthors: many(paperAuthors),
}));

// ============================================
// PAPER-AUTHOR RELATIONSHIP
// ============================================

export const paperAuthors = pgTable(
  "paper_authors",
  {
    paperId: uuid("paper_id")
      .notNull()
      .references(() => papers.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => authors.id, { onDelete: "cascade" }),
    position: integer("position").notNull(), // 1 = first author
    isCorresponding: boolean("is_corresponding").default(false),
    affiliation: text("affiliation"),
  },
  (table) => [primaryKey({ columns: [table.paperId, table.authorId] })]
);

export const paperAuthorsRelations = relations(paperAuthors, ({ one }) => ({
  paper: one(papers, {
    fields: [paperAuthors.paperId],
    references: [papers.id],
  }),
  author: one(authors, {
    fields: [paperAuthors.authorId],
    references: [authors.id],
  }),
}));

// ============================================
// SOCIAL PLATFORMS
// ============================================

export const socialPlatforms = pgTable("social_platforms", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 50 }).notNull().unique(), // 'twitter', 'bluesky', 'reddit'
  isActive: boolean("is_active").default(true),
  rateLimitPerHour: integer("rate_limit_per_hour"),
  createdAt: timestamp("created_at").defaultNow(),
});

// ============================================
// SOCIAL MENTIONS
// ============================================

export const socialMentions = pgTable(
  "social_mentions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paperId: uuid("paper_id")
      .notNull()
      .references(() => papers.id, { onDelete: "cascade" }),
    platformId: integer("platform_id")
      .notNull()
      .references(() => socialPlatforms.id),

    // Content
    externalId: varchar("external_id", { length: 500 }).notNull(), // tweet ID, post URI
    authorHandle: varchar("author_handle", { length: 255 }),
    authorName: varchar("author_name", { length: 255 }),
    authorProfileUrl: text("author_profile_url"),
    content: text("content"),
    url: text("url").notNull(),

    // Engagement metrics
    likes: integer("likes").default(0),
    reposts: integer("reposts").default(0),
    replies: integer("replies").default(0),

    // Metadata
    postedAt: timestamp("posted_at"),
    fetchedAt: timestamp("fetched_at").defaultNow(),

    // Deduplication hash
    contentHash: varchar("content_hash", { length: 64 }).notNull(),
  },
  (table) => [unique("social_mentions_platform_external").on(table.platformId, table.externalId)]
);

export const socialMentionsRelations = relations(socialMentions, ({ one }) => ({
  paper: one(papers, {
    fields: [socialMentions.paperId],
    references: [papers.id],
  }),
  platform: one(socialPlatforms, {
    fields: [socialMentions.platformId],
    references: [socialPlatforms.id],
  }),
}));

// ============================================
// NEWS MENTIONS
// ============================================

export const newsMentions = pgTable("news_mentions", {
  id: uuid("id").primaryKey().defaultRandom(),
  paperId: uuid("paper_id")
    .notNull()
    .references(() => papers.id, { onDelete: "cascade" }),

  title: text("title").notNull(),
  snippet: text("snippet"),
  url: text("url").notNull(),
  sourceName: varchar("source_name", { length: 255 }), // 'MIT Technology Review'
  publishedAt: timestamp("published_at"),
  imageUrl: text("image_url"),

  // Deduplication
  urlHash: varchar("url_hash", { length: 64 }).notNull().unique(),

  fetchedAt: timestamp("fetched_at").defaultNow(),
});

export const newsMentionsRelations = relations(newsMentions, ({ one }) => ({
  paper: one(papers, {
    fields: [newsMentions.paperId],
    references: [papers.id],
  }),
}));

// ============================================
// AUTH.JS TABLES
// ============================================

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }).unique(),
  emailVerified: timestamp("email_verified"),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 255 }).notNull(),
    provider: varchar("provider", { length: 255 }).notNull(),
    providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: varchar("token_type", { length: 255 }),
    scope: varchar("scope", { length: 255 }),
    id_token: text("id_token"),
    session_state: varchar("session_state", { length: 255 }),
  },
  (table) => [primaryKey({ columns: [table.provider, table.providerAccountId] })]
);

export const sessions = pgTable("sessions", {
  sessionToken: varchar("session_token", { length: 255 }).primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires").notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: varchar("identifier", { length: 255 }).notNull(),
    token: varchar("token", { length: 255 }).notNull(),
    expires: timestamp("expires").notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })]
);

// ============================================
// USER FEATURES
// ============================================

export const userSavedPapers = pgTable(
  "user_saved_papers",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    paperId: uuid("paper_id")
      .notNull()
      .references(() => papers.id, { onDelete: "cascade" }),
    savedAt: timestamp("saved_at").defaultNow(),
    notes: text("notes"),
  },
  (table) => [primaryKey({ columns: [table.userId, table.paperId] })]
);

export const userFollowedAuthors = pgTable(
  "user_followed_authors",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => authors.id, { onDelete: "cascade" }),
    followedAt: timestamp("followed_at").defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.authorId] })]
);

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  categories: text("categories").array().default(["cs.AI"]),
  emailDigest: varchar("email_digest", { length: 20 }).default("daily"), // 'none', 'daily', 'weekly'
  notificationNewPapers: boolean("notification_new_papers").default(true),
  notificationSocialMentions: boolean("notification_social_mentions").default(true),
});

// ============================================
// JOB TRACKING
// ============================================

export const jobRuns = pgTable("job_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  jobType: varchar("job_type", { length: 100 }).notNull(),
  jobId: varchar("job_id", { length: 255 }),
  status: varchar("status", { length: 50 }).notNull(), // 'started', 'completed', 'failed'
  payload: jsonb("payload"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  durationMs: integer("duration_ms"),
});

export const apiUsage = pgTable("api_usage", {
  id: serial("id").primaryKey(),
  service: varchar("service", { length: 50 }).notNull(), // 'openrouter', 'serper', etc.
  endpoint: varchar("endpoint", { length: 255 }),
  tokensUsed: integer("tokens_used"),
  costCents: integer("cost_cents"),
  usedAt: timestamp("used_at").defaultNow(),
});

// ============================================
// TYPE EXPORTS
// ============================================

export type Paper = typeof papers.$inferSelect;
export type NewPaper = typeof papers.$inferInsert;
export type Author = typeof authors.$inferSelect;
export type NewAuthor = typeof authors.$inferInsert;
export type SocialMention = typeof socialMentions.$inferSelect;
export type NewsMention = typeof newsMentions.$inferSelect;
export type User = typeof users.$inferSelect;
