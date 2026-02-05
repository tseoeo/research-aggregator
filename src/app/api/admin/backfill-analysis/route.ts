/**
 * Backfill Analysis Endpoint
 *
 * Queues all existing papers that don't have DTL-P analysis for processing.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, paperCardAnalyses } from "@/lib/db/schema";
import { analysisQueue } from "@/lib/queue/queues";
import { eq, isNull, sql } from "drizzle-orm";
import { verifyAdminAuth } from "@/lib/auth/admin";
import { isAiEnabled, getAiStatusMessage } from "@/lib/ai/config";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/backfill-analysis
 *
 * Queue all papers without analysis for DTL-P processing.
 *
 * Authentication: Authorization: Bearer <ADMIN_SECRET>
 *
 * Query params:
 * - limit: max papers to queue (default: all)
 * - delay: milliseconds between jobs (default: 15000)
 */
export async function POST(request: NextRequest) {
  // Verify admin auth via Authorization header
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) {
    return auth.error;
  }

  // Check if AI is enabled
  if (!isAiEnabled()) {
    return NextResponse.json(
      {
        error: "AI processing is not available",
        message: getAiStatusMessage(),
        hint: "Set AI_ENABLED=true and configure OPENROUTER_API_KEY to enable AI features"
      },
      { status: 503 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!, 10) : undefined;
    const delayMs = parseInt(searchParams.get("delay") || "15000", 10);

    console.log(`[BackfillAnalysis] Starting backfill (limit=${limit || "all"}, delay=${delayMs}ms)`);

    // Query papers without analysis using a subquery approach
    const unanalyzedPapers = await db
      .select({
        id: papers.id,
        title: papers.title,
        abstract: papers.abstract,
        externalId: papers.externalId,
      })
      .from(papers)
      .where(
        sql`${papers.id} NOT IN (SELECT paper_id FROM paper_card_analyses)`
      )
      .limit(limit || 10000);

    console.log(`[BackfillAnalysis] Found ${unanalyzedPapers.length} papers without analysis`);

    if (unanalyzedPapers.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No papers need analysis",
        queued: 0,
      });
    }

    // Queue each paper with staggered delays
    let queued = 0;
    for (let i = 0; i < unanalyzedPapers.length; i++) {
      const paper = unanalyzedPapers[i];

      await analysisQueue.add(
        "backfill-analysis",
        {
          paperId: paper.id,
          title: paper.title,
          abstract: paper.abstract,
        },
        {
          delay: i * delayMs,
          jobId: `backfill-${paper.id}`, // Prevent duplicate jobs
        }
      );

      queued++;

      // Log progress every 50 papers
      if (queued % 50 === 0) {
        console.log(`[BackfillAnalysis] Queued ${queued}/${unanalyzedPapers.length}`);
      }
    }

    const estimatedMinutes = Math.ceil((unanalyzedPapers.length * delayMs) / 60000);

    console.log(`[BackfillAnalysis] Complete: queued ${queued} papers`);

    return NextResponse.json({
      success: true,
      queued,
      totalUnanalyzed: unanalyzedPapers.length,
      delayMs,
      estimatedMinutes,
      message: `Queued ${queued} papers for DTL-P analysis. Estimated completion: ~${estimatedMinutes} minutes.`,
    });
  } catch (error) {
    console.error("[BackfillAnalysis] Error:", error);
    return NextResponse.json(
      { error: "Backfill failed", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/backfill-analysis
 *
 * Show backfill status and info.
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
    // Count total papers
    const totalResult = await db
      .select({ count: sql`count(*)` })
      .from(papers);
    const totalPapers = Number(totalResult[0].count);

    // Count analyzed papers
    const analyzedResult = await db
      .select({ count: sql`count(*)` })
      .from(paperCardAnalyses);
    const analyzedPapers = Number(analyzedResult[0].count);

    // Get queue stats
    const waiting = await analysisQueue.getWaitingCount();
    const active = await analysisQueue.getActiveCount();
    const delayed = await analysisQueue.getDelayedCount();
    const completed = await analysisQueue.getCompletedCount();
    const failed = await analysisQueue.getFailedCount();

    return NextResponse.json({
      aiStatus: getAiStatusMessage(),
      papers: {
        total: totalPapers,
        analyzed: analyzedPapers,
        pending: totalPapers - analyzedPapers,
        percentComplete: totalPapers > 0
          ? Math.round((analyzedPapers / totalPapers) * 100)
          : 0,
      },
      queue: {
        waiting,
        active,
        delayed,
        completed,
        failed,
      },
      endpoint: {
        method: "POST",
        path: "/api/admin/backfill-analysis",
        authentication: "Authorization: Bearer <ADMIN_SECRET>",
        params: {
          limit: "Max papers to queue (optional)",
          delay: "Milliseconds between jobs (default: 15000)",
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to get status", details: String(error) },
      { status: 500 }
    );
  }
}
