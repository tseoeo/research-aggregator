import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  papers,
  paperAuthors,
  authors,
  socialMentions,
  newsMentions,
  socialPlatforms,
  paperCardAnalyses,
} from "@/lib/db/schema";
import { eq, desc, like, or, sql, arrayContains } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/papers
 *
 * Fetch papers from database with all related data (summaries, social, news).
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get("category") || "cs.AI";
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 100);
    const search = searchParams.get("search");

    // Build query conditions
    let whereCondition;
    if (search) {
      whereCondition = or(
        like(papers.title, `%${search}%`),
        like(papers.abstract, `%${search}%`)
      );
    } else {
      // Check if category appears in the categories array (not just primary)
      whereCondition = arrayContains(papers.categories, [category]);
    }

    // Query papers from database
    const dbPapers = await db
      .select()
      .from(papers)
      .where(whereCondition)
      .orderBy(desc(papers.publishedAt))
      .limit(limit);

    // If no papers in DB, return empty (worker will populate)
    if (dbPapers.length === 0) {
      return NextResponse.json({
        papers: [],
        pagination: { limit, category, total: 0 },
      });
    }

    // Get all related data for each paper
    const enrichedPapers = await Promise.all(
      dbPapers.map(async (paper) => {
        // Get authors
        const paperAuthorsData = await db
          .select({
            name: authors.name,
            id: authors.id,
          })
          .from(paperAuthors)
          .innerJoin(authors, eq(paperAuthors.authorId, authors.id))
          .where(eq(paperAuthors.paperId, paper.id))
          .orderBy(paperAuthors.position);

        // Get social mentions with platform info
        const mentions = await db
          .select({
            id: socialMentions.id,
            platformName: socialPlatforms.name,
            authorHandle: socialMentions.authorHandle,
            authorName: socialMentions.authorName,
            content: socialMentions.content,
            url: socialMentions.url,
            likes: socialMentions.likes,
            reposts: socialMentions.reposts,
            replies: socialMentions.replies,
            postedAt: socialMentions.postedAt,
          })
          .from(socialMentions)
          .innerJoin(socialPlatforms, eq(socialMentions.platformId, socialPlatforms.id))
          .where(eq(socialMentions.paperId, paper.id))
          .orderBy(desc(sql`${socialMentions.likes} + ${socialMentions.reposts}`))
          .limit(10);

        // Get news mentions
        const news = await db
          .select({
            id: newsMentions.id,
            title: newsMentions.title,
            snippet: newsMentions.snippet,
            url: newsMentions.url,
            sourceName: newsMentions.sourceName,
            publishedAt: newsMentions.publishedAt,
            imageUrl: newsMentions.imageUrl,
          })
          .from(newsMentions)
          .where(eq(newsMentions.paperId, paper.id))
          .orderBy(desc(newsMentions.publishedAt))
          .limit(5);

        // Get DTL-P analysis (full data for card display)
        const analysisResult = await db
          .select()
          .from(paperCardAnalyses)
          .where(eq(paperCardAnalyses.paperId, paper.id))
          .limit(1);

        const analysis = analysisResult.length > 0 ? analysisResult[0] : null;

        return {
          id: paper.id,
          externalId: paper.externalId,
          title: paper.title,
          abstract: paper.abstract,
          publishedAt: paper.publishedAt?.toISOString() || null,
          primaryCategory: paper.primaryCategory,
          pdfUrl: paper.pdfUrl,
          summaryBullets: paper.summaryBullets,
          summaryEli5: paper.summaryEli5,
          authors: paperAuthorsData,
          socialMentions: mentions.map((m) => ({
            ...m,
            postedAt: m.postedAt?.toISOString() || null,
          })),
          newsMentions: news.map((n) => ({
            ...n,
            publishedAt: n.publishedAt?.toISOString() || null,
          })),
          mentionCount: mentions.length,
          // Full DTL-P analysis for card display
          analysis: analysis ? {
            role: analysis.role,
            roleConfidence: analysis.roleConfidence,
            timeToValue: analysis.timeToValue,
            timeToValueConfidence: analysis.timeToValueConfidence,
            interestingness: analysis.interestingness,
            businessPrimitives: analysis.businessPrimitives,
            keyNumbers: analysis.keyNumbers,
            constraints: analysis.constraints,
            failureModes: analysis.failureModes,
            whatIsMissing: analysis.whatIsMissing,
            readinessLevel: analysis.readinessLevel,
            readinessJustification: analysis.readinessJustification,
            readinessEvidencePointers: analysis.readinessEvidencePointers,
            useCaseMappings: [], // TODO: fetch from paperUseCaseMappings table
            publicViews: analysis.publicViews,
          } : null,
        };
      })
    );

    return NextResponse.json({
      papers: enrichedPapers,
      pagination: {
        limit,
        category,
        total: enrichedPapers.length,
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
