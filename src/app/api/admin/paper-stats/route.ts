/**
 * Paper Stats API (Phase 4: Enhanced Monitoring)
 *
 * Returns paper counts by day for monitoring ingestion.
 * Enhanced with health status, missing dates detection, and expected ranges.
 *
 * Authentication: Authorization: Bearer <ADMIN_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, ingestionRuns } from "@/lib/db/schema";
import { sql, gte, lte, and, desc } from "drizzle-orm";
import { verifyAdminAuth } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

// Expected papers per day based on historical arXiv AI volume
const EXPECTED_MIN_PAPERS_PER_DAY = 300;
const EXPECTED_MAX_PAPERS_PER_DAY = 600;

// Thresholds for health status
const WARNING_THRESHOLD = 100; // Below this is a warning
const CRITICAL_THRESHOLD = 50; // Below this is critical

type HealthStatus = "healthy" | "warning" | "critical";

interface DateCount {
  date: string;
  count: number;
}

/**
 * Determine health status based on recent ingestion
 */
function determineHealth(
  todayCount: number,
  missingDates: string[]
): { status: HealthStatus; reason?: string } {
  // Check for missing dates in last 7 days (critical)
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
  const recentMissing = missingDates.filter((d) => new Date(d) >= sevenDaysAgo);

  if (recentMissing.length > 0) {
    return {
      status: "critical",
      reason: `Missing data for ${recentMissing.length} dates in last 7 days: ${recentMissing.join(", ")}`,
    };
  }

  // Check today's count
  if (todayCount < CRITICAL_THRESHOLD) {
    return {
      status: "critical",
      reason: `Today's ingestion (${todayCount}) is below critical threshold (${CRITICAL_THRESHOLD})`,
    };
  }

  if (todayCount < WARNING_THRESHOLD) {
    return {
      status: "warning",
      reason: `Today's ingestion (${todayCount}) is below warning threshold (${WARNING_THRESHOLD})`,
    };
  }

  return { status: "healthy" };
}

/**
 * Find dates with missing or low data (Phase C: uses publishedAt)
 */
function findMissingDates(
  paperCounts: DateCount[],
  days: number,
  minPapersPerDay: number = CRITICAL_THRESHOLD
): string[] {
  const countsByDate = new Map<string, number>();
  for (const row of paperCounts) {
    countsByDate.set(row.date, row.count);
  }

  const missingDates: string[] = [];
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - days);

  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);

  const current = new Date(cutoff);
  while (current <= yesterday) {
    const dateStr = current.toISOString().split("T")[0];
    const count = countsByDate.get(dateStr) || 0;

    // Skip weekends (arXiv doesn't publish on weekends)
    const dayOfWeek = current.getUTCDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (!isWeekend && count < minPapersPerDay) {
      missingDates.push(dateStr);
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return missingDates;
}

export async function GET(request: NextRequest) {
  // Verify admin auth via Authorization header
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) {
    return auth.error;
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const days = Math.min(parseInt(searchParams.get("days") || "10"), 30);

    const cutoffDate = new Date();
    cutoffDate.setUTCDate(cutoffDate.getUTCDate() - days);
    cutoffDate.setUTCHours(0, 0, 0, 0);

    // Get papers by created_at (when we fetched them)
    const byCreatedAt = await db
      .select({
        date: sql<string>`DATE(created_at)::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(papers)
      .where(gte(papers.createdAt, cutoffDate))
      .groupBy(sql`DATE(created_at)`)
      .orderBy(sql`DATE(created_at) DESC`);

    // Get papers by published_at (when arXiv published them) - Phase C: primary for gap detection
    const byPublishedAt = await db
      .select({
        date: sql<string>`DATE(published_at)::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(papers)
      .where(gte(papers.publishedAt, cutoffDate))
      .groupBy(sql`DATE(published_at)`)
      .orderBy(sql`DATE(published_at) DESC`);

    // Get total
    const totalResult = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(papers);

    // Get today's count
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayResult = await db
      .select({
        count: sql<number>`count(*)::int`,
      })
      .from(papers)
      .where(gte(papers.createdAt, today));

    const todayIngested = todayResult[0]?.count || 0;

    // Find missing dates (Phase C: based on publishedAt)
    const missingDates = findMissingDates(byPublishedAt, days);

    // Determine health status
    const health = determineHealth(todayIngested, missingDates);

    // Get recent ingestion runs (Phase A/G: from ledger if available)
    let recentRuns: Array<{
      date: string;
      category: string;
      expectedTotal: number | null;
      fetchedTotal: number | null;
      status: string;
    }> = [];

    try {
      const runs = await db
        .select({
          date: sql<string>`DATE(date)::text`,
          category: ingestionRuns.category,
          expectedTotal: ingestionRuns.expectedTotal,
          fetchedTotal: ingestionRuns.fetchedTotal,
          status: ingestionRuns.status,
        })
        .from(ingestionRuns)
        .where(gte(ingestionRuns.date, cutoffDate))
        .orderBy(desc(ingestionRuns.date))
        .limit(50);

      recentRuns = runs;
    } catch {
      // Ingestion runs table may not exist yet - ignore
    }

    // Calculate average papers per day (excluding weekends and zero days)
    const nonZeroCounts = byPublishedAt
      .filter((d) => {
        const date = new Date(d.date);
        const dayOfWeek = date.getUTCDay();
        return dayOfWeek !== 0 && dayOfWeek !== 6 && d.count > 0;
      })
      .map((d) => d.count);

    const avgPapersPerDay =
      nonZeroCounts.length > 0
        ? Math.round(nonZeroCounts.reduce((a, b) => a + b, 0) / nonZeroCounts.length)
        : 0;

    return NextResponse.json({
      status: "ok",
      health: health.status,
      healthReason: health.reason,
      totalPapers: totalResult[0]?.count || 0,
      todayIngested,
      avgPapersPerDay,
      expectedRange: [EXPECTED_MIN_PAPERS_PER_DAY, EXPECTED_MAX_PAPERS_PER_DAY],
      missingDates,
      missingDatesCount: missingDates.length,
      days,
      byFetchDate: byCreatedAt,
      byPublishDate: byPublishedAt,
      recentIngestionRuns: recentRuns.length > 0 ? recentRuns : undefined,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Failed to get paper stats",
      },
      { status: 500 }
    );
  }
}
