/**
 * Queue Summaries API
 *
 * Queues papers that don't have AI-generated summaries for processing.
 * Part of the decoupled architecture - AI processing is separate from paper ingestion.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers } from "@/lib/db/schema";
import { isNull, desc } from "drizzle-orm";
import { summaryQueue } from "@/lib/queue/queues";
import { verifyAdminAuth } from "@/lib/auth/admin";
import { isAiEnabledAsync, getAiStatusAsync, getAiStatusMessage } from "@/lib/ai/config";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/queue-summaries
 *
 * Authentication: Authorization: Bearer <ADMIN_SECRET>
 */
export async function POST(request: NextRequest) {
  // Verify admin auth via Authorization header
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) {
    return auth.error;
  }

  // Check if AI is enabled (runtime toggle)
  if (!(await isAiEnabledAsync(true))) {
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
    const limit = Math.min(body.limit || 100, 500); // Max 500 papers per request
    const delayMs = body.delayMs || 2000; // Default 2s between jobs
    const model = body.model; // Optional model override

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
      .limit(limit);

    if (papersWithoutSummaries.length === 0) {
      return NextResponse.json({
        message: "All papers have summaries",
        queued: 0,
      });
    }

    // Queue each paper for summary generation
    let queued = 0;
    for (let i = 0; i < papersWithoutSummaries.length; i++) {
      const paper = papersWithoutSummaries[i];

      await summaryQueue.add(
        "generate-summary",
        {
          paperId: paper.id,
          arxivId: paper.externalId,
          title: paper.title,
          abstract: paper.abstract,
          ...(model && { model }), // Include model if specified
        },
        { delay: i * delayMs }
      );

      queued++;
    }

    console.log(`[Admin] Queued ${queued} papers for summary generation`);

    return NextResponse.json({
      message: `Queued ${queued} papers for summary generation`,
      queued,
      totalWithoutSummaries: papersWithoutSummaries.length,
      delayMs,
      estimatedMinutes: Math.ceil((queued * delayMs) / 60000),
      ...(model && { model }),
    });
  } catch (error) {
    console.error("[Admin] Error queueing summaries:", error);
    return NextResponse.json(
      { error: "Failed to queue summaries" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/queue-summaries
 *
 * Check how many papers need summaries.
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
    const result = await db
      .select({ count: papers.id })
      .from(papers)
      .where(isNull(papers.summaryGeneratedAt));

    return NextResponse.json({
      papersWithoutSummaries: result.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to count papers" },
      { status: 500 }
    );
  }
}
