import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, paperAnalysesV3, analysisBatches, analysisBatchJobs } from "@/lib/db/schema";
import { sql, eq, and } from "drizzle-orm";
import { verifyAdminAuth } from "@/lib/auth/admin";
import { getAnalysisV3Config } from "@/lib/ai/analysis-v3-config";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) return auth.error;

  try {
    const config = await getAnalysisV3Config();

    // Coverage
    const [analyzedResult, totalResult] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` })
        .from(paperAnalysesV3)
        .where(eq(paperAnalysesV3.analysisStatus, "complete")),
      db.select({ count: sql<number>`count(*)::int` }).from(papers),
    ]);

    const analyzed = analyzedResult[0]?.count || 0;
    const total = totalResult[0]?.count || 0;

    // Spending today + month
    const [todayResult, monthResult] = await Promise.all([
      db.select({ total: sql<number>`COALESCE(SUM(cost_cents), 0)::int` })
        .from(analysisBatchJobs)
        .where(and(
          eq(analysisBatchJobs.status, "completed"),
          sql`${analysisBatchJobs.completedAt} >= CURRENT_DATE`
        )),
      db.select({ total: sql<number>`COALESCE(SUM(cost_cents), 0)::int` })
        .from(analysisBatchJobs)
        .where(and(
          eq(analysisBatchJobs.status, "completed"),
          sql`${analysisBatchJobs.completedAt} >= DATE_TRUNC('month', CURRENT_DATE)`
        )),
    ]);

    // Current running batch
    const runningBatch = await db
      .select()
      .from(analysisBatches)
      .where(eq(analysisBatches.status, "running"))
      .limit(1);

    const model = process.env.OPENROUTER_MODEL || "moonshotai/kimi-k2.5";

    return NextResponse.json({
      coverage: {
        analyzed,
        total,
        percentage: total > 0 ? Math.round((analyzed / total) * 1000) / 10 : 0,
      },
      budget: {
        dailyCents: config.dailyBudgetCents,
        monthlyCents: config.monthlyBudgetCents,
        todaySpentCents: todayResult[0]?.total || 0,
        monthSpentCents: monthResult[0]?.total || 0,
      },
      autoAnalysis: {
        enabled: config.autoEnabled,
        paused: config.paused,
        pauseReason: config.pauseReason,
      },
      currentBatch: runningBatch[0]
        ? {
            id: runningBatch[0].id,
            batchSize: runningBatch[0].batchSize,
            completed: runningBatch[0].completed,
            failed: runningBatch[0].failed,
            status: runningBatch[0].status,
            model: runningBatch[0].model,
            startedAt: runningBatch[0].startedAt?.toISOString() || null,
          }
        : null,
      model,
    });
  } catch (error) {
    console.error("[AnalysisV3 Status] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch status" },
      { status: 500 }
    );
  }
}
