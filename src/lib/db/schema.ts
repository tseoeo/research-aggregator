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
  doublePrecision,
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
  cardAnalysis: one(paperCardAnalyses, {
    fields: [papers.id],
    references: [paperCardAnalyses.paperId],
  }),
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
// INGESTION LEDGER (Phase A)
// ============================================

export const ingestionRuns = pgTable(
  "ingestion_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    date: timestamp("date").notNull(), // UTC date of papers being fetched
    category: varchar("category", { length: 50 }).notNull(), // arXiv category (cs.AI, cs.LG, etc.)
    expectedTotal: integer("expected_total"), // from opensearch:totalResults
    fetchedTotal: integer("fetched_total").default(0),
    status: varchar("status", { length: 50 }).notNull().default("started"), // started | completed | partial | failed
    lastStartIndex: integer("last_start_index").default(0), // for resume capability
    startedAt: timestamp("started_at").defaultNow(),
    completedAt: timestamp("completed_at"),
    errorMessage: text("error_message"),
  },
  (table) => [unique("ingestion_runs_date_category").on(table.date, table.category)]
);

// ============================================
// DTL-P: TAXONOMY REGISTRY
// ============================================

export const taxonomyEntries = pgTable("taxonomy_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  type: varchar("type", { length: 50 }).notNull().default("use_case"), // 'use_case' for now
  name: varchar("name", { length: 255 }).notNull().unique(),
  definition: text("definition"),
  inclusions: text("inclusions").array(), // what this category includes
  exclusions: text("exclusions").array(), // what this category excludes
  examples: text("examples").array(), // 3 example use cases
  synonyms: text("synonyms").array(), // alternative names
  status: varchar("status", { length: 50 }).notNull().default("active"), // active | deprecated | provisional
  parentId: uuid("parent_id"), // for future hierarchy (self-referencing)
  usageCount: integer("usage_count").notNull().default(0),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const taxonomyEntriesRelations = relations(taxonomyEntries, ({ many }) => ({
  paperMappings: many(paperUseCaseMappings),
}));

// ============================================
// DTL-P: PAPER CARD ANALYSES
// ============================================

export const paperCardAnalyses = pgTable(
  "paper_card_analyses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    paperId: uuid("paper_id")
      .notNull()
      .references(() => papers.id, { onDelete: "cascade" }),
    analysisVersion: varchar("analysis_version", { length: 50 }).notNull().default("dtlp_v1"),

    // Forced labels
    role: varchar("role", { length: 50 }).notNull(), // Primitive | Platform | Proof | Provocation
    roleConfidence: doublePrecision("role_confidence").notNull(),
    timeToValue: varchar("time_to_value", { length: 50 }).notNull(), // Now | Soon | Later | Unknown
    timeToValueConfidence: doublePrecision("time_to_value_confidence").notNull(),

    // Interestingness scoring (JSONB for flexibility)
    // { total_score: 0-12, tier: string, checks: [{check_id, score, answer, evidence_pointers, notes}] }
    interestingness: jsonb("interestingness").notNull(),

    // Business primitives
    // { selected: string[], justification: string, evidence_pointers: string[] }
    businessPrimitives: jsonb("business_primitives"),

    // Key numbers (array of up to 3)
    // [{ metric_name, value, direction, baseline, conditions, evidence_pointer }]
    keyNumbers: jsonb("key_numbers"),

    // Constraints (array of up to 3)
    // [{ constraint, why_it_matters, evidence_pointer }]
    constraints: jsonb("constraints"),

    // Failure modes (array of up to 3)
    // [{ failure_mode, why_it_matters, evidence_pointer }]
    failureModes: jsonb("failure_modes"),

    // What's missing
    whatIsMissing: text("what_is_missing").array(),

    // Readiness assessment
    readinessLevel: varchar("readiness_level", { length: 50 }), // research_only | prototype_candidate | deployable_with_work
    readinessJustification: text("readiness_justification"),
    readinessEvidencePointers: text("readiness_evidence_pointers").array(),

    // Public views (derived summaries)
    // { hook_sentence, 30s_summary, 3m_summary, 8m_operator_addendum }
    publicViews: jsonb("public_views"),

    // Taxonomy proposals (if any new use-cases proposed)
    // [{ type, proposed_name, definition, inclusions, exclusions, synonyms, examples, rationale }]
    taxonomyProposals: jsonb("taxonomy_proposals"),

    // Metadata
    analysisModel: varchar("analysis_model", { length: 100 }),
    tokensUsed: integer("tokens_used"),
    errorMessage: text("error_message"), // if analysis failed
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (table) => [unique("paper_card_analyses_paper_id").on(table.paperId)]
);

export const paperCardAnalysesRelations = relations(paperCardAnalyses, ({ one, many }) => ({
  paper: one(papers, {
    fields: [paperCardAnalyses.paperId],
    references: [papers.id],
  }),
  useCaseMappings: many(paperUseCaseMappings),
}));

// ============================================
// DTL-P: PAPER-USE CASE MAPPINGS
// ============================================

export const paperUseCaseMappings = pgTable(
  "paper_use_case_mappings",
  {
    analysisId: uuid("analysis_id")
      .notNull()
      .references(() => paperCardAnalyses.id, { onDelete: "cascade" }),
    taxonomyEntryId: uuid("taxonomy_entry_id")
      .notNull()
      .references(() => taxonomyEntries.id, { onDelete: "cascade" }),
    fitConfidence: varchar("fit_confidence", { length: 20 }).notNull(), // low | med | high
    because: text("because").notNull(), // evidence-backed justification
    evidencePointers: text("evidence_pointers").array(),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.analysisId, table.taxonomyEntryId] })]
);

export const paperUseCaseMappingsRelations = relations(paperUseCaseMappings, ({ one }) => ({
  analysis: one(paperCardAnalyses, {
    fields: [paperUseCaseMappings.analysisId],
    references: [paperCardAnalyses.id],
  }),
  taxonomyEntry: one(taxonomyEntries, {
    fields: [paperUseCaseMappings.taxonomyEntryId],
    references: [taxonomyEntries.id],
  }),
}));

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

// DTL-P Types
export type TaxonomyEntry = typeof taxonomyEntries.$inferSelect;
export type NewTaxonomyEntry = typeof taxonomyEntries.$inferInsert;
export type PaperCardAnalysis = typeof paperCardAnalyses.$inferSelect;
export type NewPaperCardAnalysis = typeof paperCardAnalyses.$inferInsert;
export type PaperUseCaseMapping = typeof paperUseCaseMappings.$inferSelect;
export type NewPaperUseCaseMapping = typeof paperUseCaseMappings.$inferInsert;

// Ingestion Ledger Types
export type IngestionRun = typeof ingestionRuns.$inferSelect;
export type NewIngestionRun = typeof ingestionRuns.$inferInsert;
