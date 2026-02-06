import { NextRequest, NextResponse } from "next/server";
import { OpenRouterService } from "@/lib/services/openrouter";
import { arxivService } from "@/lib/services/arxiv";

import { getAiEnabledRuntime } from "@/lib/ai/runtime-toggle";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/papers/[id]/summary
 *
 * Generate an AI summary for a paper on-demand.
 * In production, this would check the database first and use the queue.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  if (!(await getAiEnabledRuntime())) {
    return NextResponse.json(
      { error: "AI processing is currently paused (AI_ENABLED=false)" },
      { status: 503 }
    );
  }

  try {
    const { id } = await params;

    // Fetch paper from arXiv (in production, check DB first)
    const paper = await arxivService.fetchPaperById(id);

    if (!paper) {
      return NextResponse.json(
        { error: "Paper not found" },
        { status: 404 }
      );
    }

    const openRouter = new OpenRouterService();

    if (!openRouter.isConfigured()) {
      return NextResponse.json(
        { error: "AI service not configured. Please add OPENROUTER_API_KEY to environment." },
        { status: 503 }
      );
    }

    // Generate summary
    const summary = await openRouter.generateSummary(paper.title, paper.abstract);

    return NextResponse.json({
      paperId: id,
      bullets: summary.bullets,
      eli5: summary.eli5,
      tokensUsed: summary.tokensUsed,
      model: summary.model,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating summary:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate summary" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/papers/[id]/summary
 *
 * Get the summary for a paper (generates if not exists).
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  if (!(await getAiEnabledRuntime())) {
    return NextResponse.json({
      paperId: null,
      bullets: null,
      eli5: null,
      configured: false,
      message: "AI processing is currently paused (AI_ENABLED=false)",
    });
  }

  try {
    const { id } = await params;

    // In production, this would check the database first
    // For MVP, we generate on-demand

    // Fetch paper from arXiv
    const paper = await arxivService.fetchPaperById(id);

    if (!paper) {
      return NextResponse.json(
        { error: "Paper not found" },
        { status: 404 }
      );
    }

    const openRouter = new OpenRouterService();

    if (!openRouter.isConfigured()) {
      // Return empty summary if not configured
      return NextResponse.json({
        paperId: id,
        bullets: null,
        eli5: null,
        configured: false,
        message: "AI service not configured",
      });
    }

    // Generate summary
    const summary = await openRouter.generateSummary(paper.title, paper.abstract);

    return NextResponse.json({
      paperId: id,
      bullets: summary.bullets,
      eli5: summary.eli5,
      tokensUsed: summary.tokensUsed,
      model: summary.model,
      generatedAt: new Date().toISOString(),
      configured: true,
    });
  } catch (error) {
    console.error("Error getting summary:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get summary" },
      { status: 500 }
    );
  }
}
