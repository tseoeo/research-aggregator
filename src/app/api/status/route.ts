/**
 * Status API Endpoint
 *
 * Returns information about:
 * - When papers were last fetched
 * - When the next fetch is expected
 * - Paper counts by category
 *
 * Note: arXiv fetch is scheduled daily at 22:00 UTC (1 hour after arXiv publishes new papers at ~21:00 UTC)
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Calculate the next scheduled fetch time.
 * arXiv fetch runs daily at 22:00 UTC.
 */
function calculateNextFetch(): Date {
  const now = new Date();
  const next = new Date(now);

  // Set to 22:00 UTC today
  next.setUTCHours(22, 0, 0, 0);

  // If it's already past 22:00 UTC today, schedule for tomorrow
  if (now >= next) {
    next.setUTCDate(next.getUTCDate() + 1);
  }

  return next;
}

export async function GET() {
  try {
    // Get the most recent paper's fetchedAt timestamp
    const recentPaper = await db
      .select({
        fetchedAt: papers.fetchedAt,
      })
      .from(papers)
      .orderBy(desc(papers.fetchedAt))
      .limit(1);

    const lastFetch = recentPaper[0]?.fetchedAt || null;

    // Calculate next fetch (daily at 22:00 UTC)
    const nextFetch = calculateNextFetch();

    // Get total paper count
    const totalResult = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(papers);

    const totalPapers = totalResult[0]?.count || 0;

    // Get counts by primary category
    const categoryCounts = await db
      .select({
        category: papers.primaryCategory,
        count: sql<number>`count(*)::int`,
      })
      .from(papers)
      .groupBy(papers.primaryCategory)
      .orderBy(desc(sql`count(*)`));

    // Convert to object format
    const categoryCountsObj: Record<string, number> = {};
    for (const row of categoryCounts) {
      if (row.category) {
        categoryCountsObj[row.category] = row.count;
      }
    }

    return NextResponse.json({
      lastFetch: lastFetch?.toISOString() || null,
      nextFetch: nextFetch?.toISOString() || null,
      totalPapers,
      categoryCounts: categoryCountsObj,
    });
  } catch (error) {
    console.error("[Status API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch status" },
      { status: 500 }
    );
  }
}
