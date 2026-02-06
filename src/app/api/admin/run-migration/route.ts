/**
 * One-time migration endpoint to create paper_analyses_v3 table.
 * Remove this endpoint after the table is created.
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

  try {
    // Check if table already exists
    const tableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'paper_analyses_v3'
      ) as table_exists
    `);

    const exists = (tableCheck as unknown as { table_exists: boolean }[])?.[0]?.table_exists === true;

    if (exists) {
      return NextResponse.json({ message: "Table paper_analyses_v3 already exists", created: false });
    }

    // Create the table
    await db.execute(sql`
      CREATE TABLE paper_analyses_v3 (
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

    // Create indexes
    await db.execute(sql`CREATE INDEX idx_paper_analyses_v3_paper_id ON paper_analyses_v3(paper_id)`);
    await db.execute(sql`CREATE INDEX idx_paper_analyses_v3_practical_value ON paper_analyses_v3(practical_value_total)`);
    await db.execute(sql`CREATE INDEX idx_paper_analyses_v3_readiness ON paper_analyses_v3(readiness_level)`);
    await db.execute(sql`CREATE INDEX idx_paper_analyses_v3_time_to_value ON paper_analyses_v3(time_to_value)`);
    await db.execute(sql`CREATE INDEX idx_paper_analyses_v3_what_kind ON paper_analyses_v3(what_kind)`);

    return NextResponse.json({ message: "Table paper_analyses_v3 created successfully", created: true });
  } catch (error) {
    console.error("[Migration] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Migration failed" },
      { status: 500 }
    );
  }
}
