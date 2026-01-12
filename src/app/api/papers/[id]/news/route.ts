import { NextRequest, NextResponse } from "next/server";
import { arxivService } from "@/lib/services/arxiv";
import { serperService } from "@/lib/services/serper";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/papers/[id]/news
 *
 * Fetch news articles mentioning a paper.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check if Serper is enabled
    if (!serperService.isEnabled()) {
      return NextResponse.json({
        paperId: id,
        news: [],
        enabled: false,
        message: "News search is not configured",
        fetchedAt: new Date().toISOString(),
      });
    }

    // Fetch paper info from arXiv
    const paper = await arxivService.fetchPaperById(id);

    if (!paper) {
      return NextResponse.json(
        { error: "Paper not found" },
        { status: 404 }
      );
    }

    // Search for news about the paper
    const news = await serperService.searchForPaper(paper.title, paper.arxivId);

    return NextResponse.json({
      paperId: id,
      paperTitle: paper.title,
      news,
      count: news.length,
      enabled: true,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching news:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch news" },
      { status: 500 }
    );
  }
}
