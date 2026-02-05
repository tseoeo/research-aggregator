/**
 * Paper Stats API
 *
 * Returns paper counts by day for monitoring ingestion.
 *
 * Authentication: Authorization: Bearer <ADMIN_SECRET>
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers } from "@/lib/db/schema";
import { sql, gte } from "drizzle-orm";
import { verifyAdminAuth } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

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
    cutoffDate.setDate(cutoffDate.getDate() - days);

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

    // Get papers by published_at (when arXiv published them)
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

    return NextResponse.json({
      status: "ok",
      totalPapers: totalResult[0]?.count || 0,
      days,
      byFetchDate: byCreatedAt,
      byPublishDate: byPublishedAt,
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
