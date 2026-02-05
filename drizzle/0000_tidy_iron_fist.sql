CREATE TABLE "accounts" (
	"user_id" uuid NOT NULL,
	"type" varchar(255) NOT NULL,
	"provider" varchar(255) NOT NULL,
	"provider_account_id" varchar(255) NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" varchar(255),
	"scope" varchar(255),
	"id_token" text,
	"session_state" varchar(255),
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "api_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"service" varchar(50) NOT NULL,
	"endpoint" varchar(255),
	"tokens_used" integer,
	"cost_cents" integer,
	"used_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "authors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"normalized_name" varchar(255),
	"orcid" varchar(50),
	"openalex_id" varchar(100),
	"semantic_scholar_id" varchar(100),
	"google_scholar_id" varchar(100),
	"twitter_handle" varchar(100),
	"bluesky_handle" varchar(100),
	"github_handle" varchar(100),
	"linkedin_url" text,
	"personal_website" text,
	"social_discovery_status" varchar(50) DEFAULT 'pending',
	"social_discovery_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "authors_orcid_unique" UNIQUE("orcid")
);
--> statement-breakpoint
CREATE TABLE "ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" timestamp NOT NULL,
	"category" varchar(50) NOT NULL,
	"expected_total" integer,
	"fetched_total" integer DEFAULT 0,
	"status" varchar(50) DEFAULT 'started' NOT NULL,
	"last_start_index" integer DEFAULT 0,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"error_message" text,
	CONSTRAINT "ingestion_runs_date_category" UNIQUE("date","category")
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_type" varchar(100) NOT NULL,
	"job_id" varchar(255),
	"status" varchar(50) NOT NULL,
	"payload" jsonb,
	"error_message" text,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "news_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paper_id" uuid NOT NULL,
	"title" text NOT NULL,
	"snippet" text,
	"url" text NOT NULL,
	"source_name" varchar(255),
	"published_at" timestamp,
	"image_url" text,
	"url_hash" varchar(64) NOT NULL,
	"fetched_at" timestamp DEFAULT now(),
	CONSTRAINT "news_mentions_url_hash_unique" UNIQUE("url_hash")
);
--> statement-breakpoint
CREATE TABLE "paper_authors" (
	"paper_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"is_corresponding" boolean DEFAULT false,
	"affiliation" text,
	CONSTRAINT "paper_authors_paper_id_author_id_pk" PRIMARY KEY("paper_id","author_id")
);
--> statement-breakpoint
CREATE TABLE "paper_card_analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paper_id" uuid NOT NULL,
	"analysis_version" varchar(50) DEFAULT 'dtlp_v1' NOT NULL,
	"core_claim" text,
	"role" varchar(50) NOT NULL,
	"role_confidence" double precision NOT NULL,
	"time_to_value" varchar(50) NOT NULL,
	"time_to_value_confidence" double precision NOT NULL,
	"interestingness" jsonb NOT NULL,
	"business_primitives" jsonb,
	"key_numbers" jsonb,
	"constraints" jsonb,
	"failure_modes" jsonb,
	"what_is_missing" text[],
	"readiness_level" varchar(50),
	"readiness_justification" text,
	"readiness_evidence_pointers" text[],
	"public_views" jsonb,
	"taxonomy_proposals" jsonb,
	"prompt_hash" varchar(64),
	"analysis_status" varchar(50) DEFAULT 'complete',
	"validation_errors" text[],
	"analysis_model" varchar(100),
	"tokens_used" integer,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "paper_card_analyses_paper_id" UNIQUE("paper_id")
);
--> statement-breakpoint
CREATE TABLE "paper_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"base_url" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "paper_sources_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "paper_use_case_mappings" (
	"analysis_id" uuid NOT NULL,
	"taxonomy_entry_id" uuid NOT NULL,
	"fit_confidence" varchar(20) NOT NULL,
	"because" text NOT NULL,
	"evidence_pointers" text[],
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "paper_use_case_mappings_analysis_id_taxonomy_entry_id_pk" PRIMARY KEY("analysis_id","taxonomy_entry_id")
);
--> statement-breakpoint
CREATE TABLE "papers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" integer NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"title" text NOT NULL,
	"abstract" text,
	"published_at" timestamp,
	"updated_at" timestamp,
	"pdf_url" text,
	"categories" text[],
	"primary_category" varchar(50),
	"summary_bullets" text[],
	"summary_eli5" text,
	"summary_generated_at" timestamp,
	"summary_model" varchar(100),
	"created_at" timestamp DEFAULT now(),
	"fetched_at" timestamp DEFAULT now(),
	CONSTRAINT "papers_source_external" UNIQUE("source_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" varchar(255) PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "social_mentions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paper_id" uuid NOT NULL,
	"platform_id" integer NOT NULL,
	"external_id" varchar(500) NOT NULL,
	"author_handle" varchar(255),
	"author_name" varchar(255),
	"author_profile_url" text,
	"content" text,
	"url" text NOT NULL,
	"likes" integer DEFAULT 0,
	"reposts" integer DEFAULT 0,
	"replies" integer DEFAULT 0,
	"posted_at" timestamp,
	"fetched_at" timestamp DEFAULT now(),
	"content_hash" varchar(64) NOT NULL,
	CONSTRAINT "social_mentions_platform_external" UNIQUE("platform_id","external_id")
);
--> statement-breakpoint
CREATE TABLE "social_platforms" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"is_active" boolean DEFAULT true,
	"rate_limit_per_hour" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "social_platforms_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "taxonomy_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" varchar(50) DEFAULT 'use_case' NOT NULL,
	"name" varchar(255) NOT NULL,
	"definition" text,
	"inclusions" text[],
	"exclusions" text[],
	"examples" text[],
	"synonyms" text[],
	"status" varchar(50) DEFAULT 'active' NOT NULL,
	"parent_id" uuid,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "taxonomy_entries_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "user_followed_authors" (
	"user_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"followed_at" timestamp DEFAULT now(),
	CONSTRAINT "user_followed_authors_user_id_author_id_pk" PRIMARY KEY("user_id","author_id")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"categories" text[] DEFAULT '{"cs.AI"}',
	"email_digest" varchar(20) DEFAULT 'daily',
	"notification_new_papers" boolean DEFAULT true,
	"notification_social_mentions" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "user_saved_papers" (
	"user_id" uuid NOT NULL,
	"paper_id" uuid NOT NULL,
	"saved_at" timestamp DEFAULT now(),
	"notes" text,
	CONSTRAINT "user_saved_papers_user_id_paper_id_pk" PRIMARY KEY("user_id","paper_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255),
	"email" varchar(255),
	"email_verified" timestamp,
	"image" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" varchar(255) NOT NULL,
	"token" varchar(255) NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "news_mentions" ADD CONSTRAINT "news_mentions_paper_id_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_authors" ADD CONSTRAINT "paper_authors_paper_id_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_authors" ADD CONSTRAINT "paper_authors_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_card_analyses" ADD CONSTRAINT "paper_card_analyses_paper_id_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_use_case_mappings" ADD CONSTRAINT "paper_use_case_mappings_analysis_id_paper_card_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."paper_card_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paper_use_case_mappings" ADD CONSTRAINT "paper_use_case_mappings_taxonomy_entry_id_taxonomy_entries_id_fk" FOREIGN KEY ("taxonomy_entry_id") REFERENCES "public"."taxonomy_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "papers" ADD CONSTRAINT "papers_source_id_paper_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."paper_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_mentions" ADD CONSTRAINT "social_mentions_paper_id_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "social_mentions" ADD CONSTRAINT "social_mentions_platform_id_social_platforms_id_fk" FOREIGN KEY ("platform_id") REFERENCES "public"."social_platforms"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_followed_authors" ADD CONSTRAINT "user_followed_authors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_followed_authors" ADD CONSTRAINT "user_followed_authors_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_saved_papers" ADD CONSTRAINT "user_saved_papers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_saved_papers" ADD CONSTRAINT "user_saved_papers_paper_id_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;