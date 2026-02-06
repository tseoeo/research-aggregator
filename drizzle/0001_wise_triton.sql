CREATE TABLE "paper_analyses_v3" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paper_id" uuid NOT NULL,
	"hook_sentence" text NOT NULL,
	"what_kind" varchar(50) NOT NULL,
	"time_to_value" varchar(20) NOT NULL,
	"impact_area_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"practical_value_score" jsonb NOT NULL,
	"practical_value_total" integer NOT NULL,
	"key_numbers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"readiness_level" varchar(30) NOT NULL,
	"how_this_changes_things" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"what_came_before" text NOT NULL,
	"analysis_version" varchar(20) DEFAULT 'v3' NOT NULL,
	"analysis_status" varchar(20) DEFAULT 'complete' NOT NULL,
	"analysis_model" varchar(100),
	"tokens_used" integer,
	"prompt_hash" varchar(64),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "paper_analyses_v3_paper_version" UNIQUE("paper_id","analysis_version")
);
--> statement-breakpoint
ALTER TABLE "paper_analyses_v3" ADD CONSTRAINT "paper_analyses_v3_paper_id_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;