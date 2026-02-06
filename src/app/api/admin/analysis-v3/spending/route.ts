import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analysisBatchJobs } from "@/lib/db/schema";
import { sql, eq, and } from "drizzle-orm";
import { verifyAdminAuth } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) return auth.error;

  try {
    const [today, week, month, allTime] = await Promise.all([
      db.select({ total: sql<number>`COALESCE(SUM(cost_cents), 0)::int` })
        .from(analysisBatchJobs)
        .where(and(eq(analysisBatchJobs.status, "completed"), sql`${analysisBatchJobs.completedAt} >= CURRENT_DATE`)),
      db.select({ total: sql<number>`COALESCE(SUM(cost_cents), 0)::int` })
        .from(analysisBatchJobs)
        .where(and(eq(analysisBatchJobs.status, "completed"), sql`${analysisBatchJobs.completedAt} >= DATE_TRUNC('week', CURRENT_DATE)`)),
      db.select({ total: sql<number>`COALESCE(SUM(cost_cents), 0)::int` })
        .from(analysisBatchJobs)
        .where(and(eq(analysisBatchJobs.status, "completed"), sql`${analysisBatchJobs.completedAt} >= DATE_TRUNC('month', CURRENT_DATE)`)),
      db.select({ total: sql<number>`COALESCE(SUM(cost_cents), 0)::int` })
        .from(analysisBatchJobs)
        .where(eq(analysisBatchJobs.status, "completed")),
    ]);

    return NextResponse.json({
      todayCents: today[0]?.total || 0,
      weekCents: week[0]?.total || 0,
      monthCents: month[0]?.total || 0,
      allTimeCents: allTime[0]?.total || 0,
    });
  } catch (error) {
    console.error("[AnalysisV3 Spending] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get spending" },
      { status: 500 }
    );
  }
}
