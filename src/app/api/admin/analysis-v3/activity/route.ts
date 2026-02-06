import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analysisBatchJobs, papers } from "@/lib/db/schema";
import { desc, eq, inArray } from "drizzle-orm";
import { verifyAdminAuth } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) return auth.error;

  try {
    const limit = Math.min(50, parseInt(request.nextUrl.searchParams.get("limit") || "20"));

    // Get recent completed/failed jobs
    const jobs = await db
      .select({
        id: analysisBatchJobs.id,
        batchId: analysisBatchJobs.batchId,
        paperId: analysisBatchJobs.paperId,
        status: analysisBatchJobs.status,
        costCents: analysisBatchJobs.costCents,
        tokensUsed: analysisBatchJobs.tokensUsed,
        processingTimeMs: analysisBatchJobs.processingTimeMs,
        errorMessage: analysisBatchJobs.errorMessage,
        completedAt: analysisBatchJobs.completedAt,
      })
      .from(analysisBatchJobs)
      .where(inArray(analysisBatchJobs.status, ["completed", "failed"]))
      .orderBy(desc(analysisBatchJobs.completedAt))
      .limit(limit);

    // Batch fetch paper titles
    const paperIds = [...new Set(jobs.map((j) => j.paperId).filter(Boolean))] as string[];
    const paperMap = new Map<string, string>();

    if (paperIds.length > 0) {
      const paperRows = await db
        .select({ id: papers.id, title: papers.title, externalId: papers.externalId })
        .from(papers)
        .where(inArray(papers.id, paperIds));
      for (const p of paperRows) {
        paperMap.set(p.id, p.title);
      }
    }

    return NextResponse.json({
      activity: jobs.map((j) => ({
        id: j.id,
        batchId: j.batchId,
        paperId: j.paperId,
        paperTitle: j.paperId ? paperMap.get(j.paperId) || "Unknown" : "Unknown",
        status: j.status,
        costCents: j.costCents,
        costDollars: j.costCents ? `$${(j.costCents / 100).toFixed(3)}` : null,
        processingTimeMs: j.processingTimeMs,
        processingTimeSeconds: j.processingTimeMs ? (j.processingTimeMs / 1000).toFixed(1) : null,
        errorMessage: j.errorMessage,
        completedAt: j.completedAt?.toISOString() || null,
      })),
    });
  } catch (error) {
    console.error("[AnalysisV3 Activity] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get activity" },
      { status: 500 }
    );
  }
}
