/**
 * Migration endpoint for v3 schema changes.
 * Idempotent — safe to run multiple times.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { verifyAdminAuth } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) {
    return auth.error;
  }

  const results: string[] = [];

  try {
    // 1. Create table if not exists
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS paper_analyses_v3 (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        paper_id UUID NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
        hook_sentence TEXT NOT NULL,
        what_kind VARCHAR(50) NOT NULL,
        time_to_value VARCHAR(20) NOT NULL,
        impact_area_tags JSONB NOT NULL DEFAULT '[]',
        practical_value_score JSONB NOT NULL,
        practical_value_total INTEGER NOT NULL,
        key_numbers JSONB NOT NULL DEFAULT '[]',
        readiness_level VARCHAR(30) NOT NULL,
        how_this_changes_things JSONB NOT NULL DEFAULT '[]',
        what_came_before TEXT NOT NULL,
        analysis_version VARCHAR(20) NOT NULL DEFAULT 'v3',
        analysis_status VARCHAR(20) NOT NULL DEFAULT 'complete',
        analysis_model VARCHAR(100),
        tokens_used INTEGER,
        prompt_hash VARCHAR(64),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        CONSTRAINT paper_analyses_v3_paper_version UNIQUE (paper_id, analysis_version)
      )
    `);
    results.push("Table paper_analyses_v3: ensured");

    // 2. Create all indexes (IF NOT EXISTS)
    const indexes = [
      { name: "idx_paper_analyses_v3_paper_id", sql: sql`CREATE INDEX IF NOT EXISTS idx_paper_analyses_v3_paper_id ON paper_analyses_v3(paper_id)` },
      { name: "idx_paper_analyses_v3_practical_value", sql: sql`CREATE INDEX IF NOT EXISTS idx_paper_analyses_v3_practical_value ON paper_analyses_v3(practical_value_total)` },
      { name: "idx_paper_analyses_v3_readiness", sql: sql`CREATE INDEX IF NOT EXISTS idx_paper_analyses_v3_readiness ON paper_analyses_v3(readiness_level)` },
      { name: "idx_paper_analyses_v3_time_to_value", sql: sql`CREATE INDEX IF NOT EXISTS idx_paper_analyses_v3_time_to_value ON paper_analyses_v3(time_to_value)` },
      { name: "idx_paper_analyses_v3_what_kind", sql: sql`CREATE INDEX IF NOT EXISTS idx_paper_analyses_v3_what_kind ON paper_analyses_v3(what_kind)` },
      { name: "idx_paper_analyses_v3_impact_tags (GIN)", sql: sql`CREATE INDEX IF NOT EXISTS idx_paper_analyses_v3_impact_tags ON paper_analyses_v3 USING GIN (impact_area_tags)` },
      { name: "idx_papers_published_at", sql: sql`CREATE INDEX IF NOT EXISTS idx_papers_published_at ON papers(published_at DESC)` },
    ];

    for (const idx of indexes) {
      await db.execute(idx.sql);
      results.push(`Index ${idx.name}: ensured`);
    }

    return NextResponse.json({ message: "Migration complete", results });
  } catch (error) {
    console.error("[Migration] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Migration failed", results },
      { status: 500 }
    );
  }
}
