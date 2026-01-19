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

export const dynamic = "force-dynamic";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

export async function POST(request: NextRequest) {
  // Verify admin secret
  const secret = request.nextUrl.searchParams.get("secret");
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

// GET to check how many papers need analysis
export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (!ADMIN_SECRET || secret !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
