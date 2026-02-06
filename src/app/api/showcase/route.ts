import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, paperAnalysesV3 } from "@/lib/db/schema";
import { sql, eq, count, sum } from "drizzle-orm";

export const dynamic = "force-dynamic";

// In-memory cache
let cachedResponse: { data: unknown; expiresAt: number } | null = null;
let cachedExample: { data: unknown; expiresAt: number } | null = null;

const ONE_HOUR = 60 * 60 * 1000;
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const now = Date.now();
    const refresh = request.nextUrl.searchParams.get("refresh") === "true";

    // Bust example cache on refresh
    if (refresh) {
      cachedExample = null;
    }

    // Check main cache (skip on refresh so we get a new example)
    if (!refresh && cachedResponse && cachedResponse.expiresAt > now) {
      return NextResponse.json(cachedResponse.data, {
        headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" },
      });
    }

    // --- Stats ---
    const [paperCount] = await db
      .select({ count: count() })
      .from(papers);

    const [analysisCount] = await db
      .select({ count: count() })
      .from(paperAnalysesV3)
      .where(eq(paperAnalysesV3.analysisStatus, "complete"));

    const [tokenSum] = await db
      .select({ total: sum(paperAnalysesV3.tokensUsed) })
      .from(paperAnalysesV3);

    // Average papers per day over last 30 days
    const avgPerDayResult = await db.execute<{ avg_per_day: number }>(sql`
      SELECT ROUND(AVG(daily_count))::int as avg_per_day
      FROM (
        SELECT DATE(published_at) as day, COUNT(*) as daily_count
        FROM papers
        WHERE published_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(published_at)
      ) daily
    `);
    const avgPapersPerDay = (avgPerDayResult as unknown as Array<{ avg_per_day: number }>)[0]?.avg_per_day ?? 0;

    const stats = {
      totalPapers: paperCount.count,
      analyzedPapers: analysisCount.count,
      totalTokens: Number(tokenSum.total) || 0,
      avgPapersPerDay: Number(avgPapersPerDay),
      categoriesTracked: 6,
      categories: ["cs.AI", "cs.LG", "cs.CL", "cs.CV", "cs.NE", "stat.ML"],
    };

    // --- Distributions ---

    // Practical value scores (0-6)
    const pvRows = await db.execute(sql`
      SELECT practical_value_total as score, COUNT(*)::int as count
      FROM paper_analyses_v3
      WHERE analysis_status = 'complete'
      GROUP BY practical_value_total
      ORDER BY practical_value_total
    `) as unknown as Array<{ score: number; count: number }>;
    const practicalValue = Array.from({ length: 7 }, (_, i) => ({
      score: i,
      count: Number(pvRows.find((r) => Number(r.score) === i)?.count ?? 0),
    }));

    // What Kind
    const wkRows = await db.execute(sql`
      SELECT what_kind as kind, COUNT(*)::int as count
      FROM paper_analyses_v3
      WHERE analysis_status = 'complete'
      GROUP BY what_kind
      ORDER BY count DESC
    `) as unknown as Array<{ kind: string; count: number }>;
    const whatKind = wkRows.map((r) => ({
      kind: r.kind,
      count: Number(r.count),
    }));

    // Time-to-Value
    const tvRows = await db.execute(sql`
      SELECT time_to_value as value, COUNT(*)::int as count
      FROM paper_analyses_v3
      WHERE analysis_status = 'complete'
      GROUP BY time_to_value
      ORDER BY count DESC
    `) as unknown as Array<{ value: string; count: number }>;
    const timeToValue = tvRows.map((r) => ({
      value: r.value,
      count: Number(r.count),
    }));

    // Impact Areas (each paper can have multiple tags)
    const iaRows = await db.execute(sql`
      SELECT tag as area, COUNT(*)::int as count
      FROM paper_analyses_v3,
        jsonb_array_elements_text(impact_area_tags) as tag
      WHERE analysis_status = 'complete'
      GROUP BY tag
      ORDER BY count DESC
    `) as unknown as Array<{ area: string; count: number }>;
    const impactAreas = iaRows.map((r) => ({
      area: r.area,
      count: Number(r.count),
    }));

    // Readiness Level
    const rlRows = await db.execute(sql`
      SELECT readiness_level as level, COUNT(*)::int as count
      FROM paper_analyses_v3
      WHERE analysis_status = 'complete'
      GROUP BY readiness_level
      ORDER BY count DESC
    `) as unknown as Array<{ level: string; count: number }>;
    const readinessLevel = rlRows.map((r) => ({
      level: r.level,
      count: Number(r.count),
    }));

    const distributions = {
      practicalValue,
      whatKind,
      timeToValue,
      impactAreas,
      readinessLevel,
    };

    // --- Example Paper (24h cache) ---
    let examplePaper = null;
    if (cachedExample && cachedExample.expiresAt > now) {
      examplePaper = cachedExample.data;
    } else {
      const exampleRows = await db.execute(sql`
        SELECT
          p.id, p.external_id, p.title, p.abstract, p.published_at, p.categories,
          a.hook_sentence, a.what_kind, a.time_to_value, a.impact_area_tags,
          a.practical_value_score, a.practical_value_total, a.key_numbers,
          a.readiness_level, a.how_this_changes_things, a.what_came_before
        FROM paper_analyses_v3 a
        JOIN papers p ON p.id = a.paper_id
        WHERE a.analysis_status = 'complete'
          AND a.practical_value_total >= 3
          AND p.abstract IS NOT NULL
        ORDER BY RANDOM()
        LIMIT 1
      `) as unknown as Array<Record<string, unknown>>;

      if (exampleRows.length > 0) {
        const r = exampleRows[0];

        // Fetch authors for this paper
        const authorRows = await db.execute(sql`
          SELECT au.name
          FROM paper_authors pa
          JOIN authors au ON au.id = pa.author_id
          WHERE pa.paper_id = ${r.id as string}
          ORDER BY pa.position
        `) as unknown as Array<{ name: string }>;
        const authorNames = authorRows.map((a) => a.name);

        examplePaper = {
          title: r.title,
          abstract: r.abstract,
          publishedAt: r.published_at,
          categories: r.categories,
          authors: authorNames,
          analysis: {
            hookSentence: r.hook_sentence,
            whatKind: r.what_kind,
            timeToValue: r.time_to_value,
            impactAreaTags: r.impact_area_tags,
            practicalValueScore: r.practical_value_score,
            practicalValueTotal: r.practical_value_total,
            keyNumbers: r.key_numbers,
            readinessLevel: r.readiness_level,
            howThisChangesThings: r.how_this_changes_things,
            whatCameBefore: r.what_came_before,
          },
        };

        cachedExample = { data: examplePaper, expiresAt: now + TWENTY_FOUR_HOURS };
      }
    }

    const responseData = { stats, distributions, examplePaper };

    // Only update main cache for non-refresh requests
    if (!refresh) {
      cachedResponse = { data: responseData, expiresAt: now + ONE_HOUR };
    }

    return NextResponse.json(responseData, {
      headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600" },
    });
  } catch (error) {
    console.error("[Showcase API] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch showcase data" },
      { status: 500 }
    );
  }
}
