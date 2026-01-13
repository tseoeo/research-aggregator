/**
 * Status API Endpoint
 *
 * Returns information about:
 * - When papers were last fetched
 * - When the next fetch is expected
 * - Paper counts by category
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers } from "@/lib/db/schema";
import { desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

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

    // Calculate next fetch (every 6 hours from last fetch)
    let nextFetch: Date | null = null;
    if (lastFetch) {
      nextFetch = new Date(lastFetch.getTime() + 6 * 60 * 60 * 1000);
      // If next fetch is in the past, calculate from now
      if (nextFetch < new Date()) {
        // Next fetch would be at the next 6-hour interval (0, 6, 12, 18 UTC)
        const now = new Date();
        const hour = now.getUTCHours();
        const nextInterval = Math.ceil(hour / 6) * 6;
        nextFetch = new Date(now);
        nextFetch.setUTCHours(nextInterval === 24 ? 0 : nextInterval, 0, 0, 0);
        if (nextInterval === 24) {
          nextFetch.setUTCDate(nextFetch.getUTCDate() + 1);
        }
      }
    }

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
