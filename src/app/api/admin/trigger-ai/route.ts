/**
 * Trigger AI Processing API
 *
 * Convenience endpoint to trigger both summary and analysis generation.
 * Part of the decoupled architecture - AI processing is separate from paper ingestion.
 *
 * Authentication: Authorization: Bearer <ADMIN_SECRET>
 *
 * Body: { "summaryLimit": 100, "analysisLimit": 50, "summaryModel": "...", "analysisModel": "..." }
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, paperCardAnalyses } from "@/lib/db/schema";
import { eq, isNull, desc } from "drizzle-orm";
import { summaryQueue, analysisQueue } from "@/lib/queue/queues";
import { verifyAdminAuth } from "@/lib/auth/admin";
import { isAiEnabledAsync, getAiStatusAsync, getAiStatusMessage } from "@/lib/ai/config";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Verify admin auth via Authorization header
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) {
    return auth.error;
  }

  // Check if AI is enabled (runtime toggle)
  if (!(await isAiEnabledAsync())) {
    const status = await getAiStatusAsync();
    return NextResponse.json(
      {
        error: "AI processing is not available",
        message: getAiStatusMessage(status),
        hint: "Enable AI from the admin panel or set AI_ENABLED=true"
      },
      { status: 503 }
    );
  }

  try {
    // Parse options from request body
    const body = await request.json().catch(() => ({}));
    const summaryLimit = Math.min(body.summaryLimit || 100, 500);
    const analysisLimit = Math.min(body.analysisLimit || 50, 200);
    const summaryDelayMs = body.summaryDelayMs || 2000;
    const analysisDelayMs = body.analysisDelayMs || 15000;
    const summaryModel = body.summaryModel;
    const analysisModel = body.analysisModel;

    // Find papers without summaries
    const papersWithoutSummaries = await db
      .select({
        id: papers.id,
        externalId: papers.externalId,
        title: papers.title,
        abstract: papers.abstract,
      })
      .from(papers)
      .where(isNull(papers.summaryGeneratedAt))
      .orderBy(desc(papers.createdAt))
      .limit(summaryLimit);

    // Find papers without analysis
    const papersWithoutAnalysis = await db
      .select({
        id: papers.id,
        externalId: papers.externalId,
        title: papers.title,
        abstract: papers.abstract,
        publishedAt: papers.publishedAt,
      })
      .from(papers)
      .leftJoin(paperCardAnalyses, eq(papers.id, paperCardAnalyses.paperId))
      .where(isNull(paperCardAnalyses.id))
      .orderBy(desc(papers.createdAt))
      .limit(analysisLimit);

    // Queue summaries
    let summariesQueued = 0;
    for (let i = 0; i < papersWithoutSummaries.length; i++) {
      const paper = papersWithoutSummaries[i];
      await summaryQueue.add(
        "generate-summary",
        {
          paperId: paper.id,
          arxivId: paper.externalId,
          title: paper.title,
          abstract: paper.abstract,
          ...(summaryModel && { model: summaryModel }),
        },
        { delay: i * summaryDelayMs }
      );
      summariesQueued++;
    }

    // Queue analyses (with offset to not overlap with summaries)
    let analysesQueued = 0;
    const analysisStartDelay = summariesQueued * summaryDelayMs; // Start after summaries
    for (let i = 0; i < papersWithoutAnalysis.length; i++) {
      const paper = papersWithoutAnalysis[i];
      await analysisQueue.add(
        "analyze-paper",
        {
          paperId: paper.id,
          title: paper.title,
          abstract: paper.abstract,
          year: paper.publishedAt?.getFullYear(),
          ...(analysisModel && { model: analysisModel }),
        },
        { delay: analysisStartDelay + i * analysisDelayMs }
      );
      analysesQueued++;
    }

    console.log(`[Admin] Triggered AI processing: ${summariesQueued} summaries, ${analysesQueued} analyses`);

    return NextResponse.json({
      message: "AI processing triggered",
      summaries: {
        queued: summariesQueued,
        delayMs: summaryDelayMs,
        estimatedMinutes: Math.ceil((summariesQueued * summaryDelayMs) / 60000),
        ...(summaryModel && { model: summaryModel }),
      },
      analyses: {
        queued: analysesQueued,
        delayMs: analysisDelayMs,
        startsAfterMs: analysisStartDelay,
        estimatedMinutes: Math.ceil((analysesQueued * analysisDelayMs) / 60000),
        ...(analysisModel && { model: analysisModel }),
      },
      totalEstimatedMinutes: Math.ceil(
        (summariesQueued * summaryDelayMs + analysesQueued * analysisDelayMs) / 60000
      ),
    });
  } catch (error) {
    console.error("[Admin] Error triggering AI:", error);
    return NextResponse.json(
      { error: "Failed to trigger AI processing" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/trigger-ai
 *
 * Check how many papers need AI processing.
 *
 * Authentication: Authorization: Bearer <ADMIN_SECRET>
 */
export async function GET(request: NextRequest) {
  // Verify admin auth via Authorization header
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) {
    return auth.error;
  }

  try {
    // Count papers without summaries
    const withoutSummaries = await db
      .select({ id: papers.id })
      .from(papers)
      .where(isNull(papers.summaryGeneratedAt));

    // Count papers without analysis
    const withoutAnalysis = await db
      .select({ id: papers.id })
      .from(papers)
      .leftJoin(paperCardAnalyses, eq(papers.id, paperCardAnalyses.paperId))
      .where(isNull(paperCardAnalyses.id));

    return NextResponse.json({
      papersWithoutSummaries: withoutSummaries.length,
      papersWithoutAnalysis: withoutAnalysis.length,
      totalNeedingAI: Math.max(withoutSummaries.length, withoutAnalysis.length),
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to count papers" },
      { status: 500 }
    );
  }
}
