import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, paperAnalysesV3, analysisBatchJobs } from "@/lib/db/schema";
import { sql, eq, notInArray } from "drizzle-orm";
import { verifyAdminAuth } from "@/lib/auth/admin";
import { getAnalysisV3Config } from "@/lib/ai/analysis-v3-config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) return auth.error;

  try {
    // Get averages from completed jobs
    const avgResult = await db
      .select({
        avgCostCents: sql<number>`COALESCE(AVG(cost_cents), 0)::numeric(10,2)`,
        avgTokens: sql<number>`COALESCE(AVG(tokens_used), 0)::int`,
        avgTimeMs: sql<number>`COALESCE(AVG(processing_time_ms), 0)::int`,
        totalCompleted: sql<number>`count(*)::int`,
      })
      .from(analysisBatchJobs)
      .where(eq(analysisBatchJobs.status, "completed"));

    const avg = avgResult[0];
    const totalCompleted = avg?.totalCompleted || 0;
    const avgCostCents = totalCompleted > 0 ? Number(avg?.avgCostCents) : 1.1; // default estimate
    const avgTokens = totalCompleted > 0 ? (avg?.avgTokens || 1200) : 1200;
    const avgTimeMs = totalCompleted > 0 ? (avg?.avgTimeMs || 3000) : 3000;

    // Papers remaining
    const analyzedIds = db.select({ paperId: paperAnalysesV3.paperId }).from(paperAnalysesV3);
    const remainingResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(papers)
      .where(notInArray(papers.id, analyzedIds));

    const remaining = remainingResult[0]?.count || 0;

    // Processing rate (accounting for 5/min rate limit)
    const ratePerMin = Math.min(5, 60000 / Math.max(avgTimeMs, 1000));

    // Budget info
    const config = await getAnalysisV3Config();

    // Projection table
    const batchSizes = [10, 100, 500, 1000, remaining].filter((s) => s > 0);
    const projections = batchSizes.map((size) => {
      const estCostCents = Math.round(avgCostCents * size);
      const estTimeMinutes = Math.round(size / ratePerMin);
      const exceedsDailyBudget = estCostCents > config.dailyBudgetCents;
      const exceedsMonthlyBudget = estCostCents > config.monthlyBudgetCents;

      return {
        papers: size,
        estCostCents,
        estCostDollars: `$${(estCostCents / 100).toFixed(2)}`,
        estTimeMinutes,
        estTimeFormatted: formatTime(estTimeMinutes),
        exceedsDailyBudget,
        exceedsMonthlyBudget,
      };
    });

    return NextResponse.json({
      averages: {
        costCents: Math.round(avgCostCents * 100) / 100,
        costDollars: `$${(avgCostCents / 100).toFixed(3)}`,
        tokens: avgTokens,
        timeMs: avgTimeMs,
        timeSeconds: (avgTimeMs / 1000).toFixed(1),
        ratePerMin: Math.round(ratePerMin * 10) / 10,
        totalCompleted,
      },
      remaining,
      projections,
      sufficientData: totalCompleted >= 5,
    });
  } catch (error) {
    console.error("[AnalysisV3 Estimate] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get estimates" },
      { status: 500 }
    );
  }
}

function formatTime(minutes: number): string {
  if (minutes < 1) return "< 1 min";
  if (minutes < 60) return `~${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `~${hours}h ${mins}m` : `~${hours}h`;
}
