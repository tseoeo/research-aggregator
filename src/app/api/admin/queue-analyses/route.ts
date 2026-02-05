/**
 * Queue Analyses API
 *
 * Queues papers that don't have DTL-P analysis for processing.
 * Part of the decoupled architecture - AI processing is separate from paper ingestion.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, paperCardAnalyses } from "@/lib/db/schema";
import { eq, isNull, desc } from "drizzle-orm";
import { analysisQueue } from "@/lib/queue/queues";
import { verifyAdminAuth } from "@/lib/auth/admin";
import { isAiEnabled, getAiStatusMessage } from "@/lib/ai/config";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/queue-analyses
 *
 * Authentication: Authorization: Bearer <ADMIN_SECRET>
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
    // Parse options from request body
    const body = await request.json().catch(() => ({}));
    const limit = Math.min(body.limit || 50, 200); // Max 200 papers per request (analysis is expensive)
    const delayMs = body.delayMs || 15000; // Default 15s between jobs (rate limited)
    const model = body.model; // Optional model override
    const force = body.force || false; // Force re-analysis even if exists

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
      .limit(limit);

    if (papersWithoutAnalysis.length === 0) {
      return NextResponse.json({
        message: "All papers have analysis",
        queued: 0,
      });
    }

    // Queue each paper for analysis
    let queued = 0;
    for (let i = 0; i < papersWithoutAnalysis.length; i++) {
      const paper = papersWithoutAnalysis[i];

      await analysisQueue.add(
        "analyze-paper",
        {
          paperId: paper.id,
          title: paper.title,
          abstract: paper.abstract,
          year: paper.publishedAt?.getFullYear(),
          force,
          ...(model && { model }), // Include model if specified
        },
        { delay: i * delayMs }
      );

      queued++;
    }

    console.log(`[Admin] Queued ${queued} papers for DTL-P analysis`);

    return NextResponse.json({
      message: `Queued ${queued} papers for DTL-P analysis`,
      queued,
      totalWithoutAnalysis: papersWithoutAnalysis.length,
      delayMs,
      estimatedMinutes: Math.ceil((queued * delayMs) / 60000),
      ...(model && { model }),
      force,
    });
  } catch (error) {
    console.error("[Admin] Error queueing analyses:", error);
    return NextResponse.json(
      { error: "Failed to queue analyses" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/queue-analyses
 *
 * Check how many papers need analysis.
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
    const papersWithoutAnalysis = await db
      .select({ id: papers.id })
      .from(papers)
      .leftJoin(paperCardAnalyses, eq(papers.id, paperCardAnalyses.paperId))
      .where(isNull(paperCardAnalyses.id));

    return NextResponse.json({
      papersWithoutAnalysis: papersWithoutAnalysis.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to count papers" },
      { status: 500 }
    );
  }
}
