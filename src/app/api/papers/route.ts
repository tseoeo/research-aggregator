import { NextRequest, NextResponse } from "next/server";
import { arxivService, AI_CATEGORIES } from "@/lib/services/arxiv";

export const dynamic = "force-dynamic";

/**
 * GET /api/papers
 *
 * Fetch papers from arXiv API.
 * In production, this would query the database.
 * For MVP, we fetch directly from arXiv.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get("category") || "cs.AI";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const search = searchParams.get("search");

    let papers;

    if (search) {
      // Search mode
      papers = await arxivService.searchPapers(search, category, limit);
    } else {
      // Browse mode
      papers = await arxivService.fetchRecentPapers(category, limit);
    }

    // Transform arXiv papers to our format
    const transformedPapers = papers.map((paper) => ({
      id: paper.arxivId, // Use arxivId as ID for now
      externalId: paper.arxivId,
      title: paper.title,
      abstract: paper.abstract,
      publishedAt: paper.publishedAt.toISOString(),
      primaryCategory: paper.primaryCategory,
      pdfUrl: paper.pdfUrl,
      summaryBullets: null, // Would come from DB in production
      authors: paper.authors.map((a) => ({ name: a.name })),
      mentionCount: 0, // Would come from DB
    }));

    return NextResponse.json({
      papers: transformedPapers,
      pagination: {
        limit,
        category,
        total: transformedPapers.length,
      },
    });
  } catch (error) {
    console.error("Error fetching papers:", error);
    return NextResponse.json(
      { error: "Failed to fetch papers" },
      { status: 500 }
    );
  }
}
