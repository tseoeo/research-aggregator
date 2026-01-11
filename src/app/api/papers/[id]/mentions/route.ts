import { NextRequest, NextResponse } from "next/server";
import { arxivService } from "@/lib/services/arxiv";
import {
  socialAggregatorService,
  Platform,
} from "@/lib/services/social-aggregator";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/papers/[id]/mentions
 *
 * Fetch social media mentions for a paper.
 *
 * Query params:
 * - platforms: Comma-separated list (bluesky,reddit,twitter). Default: all
 * - grouped: If "true", returns mentions grouped by platform
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;

    // Parse query params
    const platformsParam = searchParams.get("platforms");
    const grouped = searchParams.get("grouped") === "true";

    const platforms: Platform[] = platformsParam
      ? (platformsParam.split(",") as Platform[])
      : ["bluesky", "reddit", "twitter"];

    // Validate platforms
    const validPlatforms: Platform[] = ["bluesky", "reddit", "twitter"];
    const filteredPlatforms = platforms.filter((p) =>
      validPlatforms.includes(p)
    );

    // Fetch paper info from arXiv
    const paper = await arxivService.fetchPaperById(id);

    if (!paper) {
      return NextResponse.json(
        { error: "Paper not found" },
        { status: 404 }
      );
    }

    if (grouped) {
      // Return mentions grouped by platform
      const mentionsByPlatform = await socialAggregatorService.fetchMentionsByPlatform(
        paper.title,
        paper.arxivId
      );

      // Filter to requested platforms
      const filtered: Record<string, typeof mentionsByPlatform.bluesky> = {};
      for (const platform of filteredPlatforms) {
        filtered[platform] = mentionsByPlatform[platform];
      }

      const stats = {
        bluesky: mentionsByPlatform.bluesky.length,
        reddit: mentionsByPlatform.reddit.length,
        twitter: mentionsByPlatform.twitter.length,
        total:
          mentionsByPlatform.bluesky.length +
          mentionsByPlatform.reddit.length +
          mentionsByPlatform.twitter.length,
      };

      return NextResponse.json({
        paperId: id,
        paperTitle: paper.title,
        mentions: filtered,
        stats,
        fetchedAt: new Date().toISOString(),
      });
    } else {
      // Return flat list of mentions
      const mentions = await socialAggregatorService.fetchMentionsForPaper(
        paper.title,
        paper.arxivId,
        { platforms: filteredPlatforms }
      );

      const stats = socialAggregatorService.getMentionStats(mentions);

      return NextResponse.json({
        paperId: id,
        paperTitle: paper.title,
        mentions,
        stats,
        fetchedAt: new Date().toISOString(),
      });
    }
  } catch (error) {
    console.error("Error fetching mentions:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch mentions" },
      { status: 500 }
    );
  }
}
