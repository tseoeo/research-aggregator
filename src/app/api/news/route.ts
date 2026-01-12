import { NextRequest, NextResponse } from "next/server";
import { serperService } from "@/lib/services/serper";

/**
 * GET /api/news
 *
 * Fetch general AI research news.
 *
 * Query params:
 * - limit: Number of articles (default: 20, max: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);

    // Check if Serper is enabled
    if (!serperService.isEnabled()) {
      return NextResponse.json({
        news: [],
        enabled: false,
        message: "News search is not configured. Set SERPER_API_KEY to enable.",
        fetchedAt: new Date().toISOString(),
      });
    }

    const news = await serperService.searchAINews(limit);

    return NextResponse.json({
      news,
      count: news.length,
      enabled: true,
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching AI news:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch news" },
      { status: 500 }
    );
  }
}
