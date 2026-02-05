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
import { eq, desc, like, or, sql, arrayContains, inArray, ilike } from "drizzle-orm";

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
    // Use ilike for case-insensitive search (Postgres)
    let whereCondition;
    if (search) {
      whereCondition = or(
        ilike(papers.title, `%${search}%`),
        ilike(papers.abstract, `%${search}%`)
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

    // Extract paper IDs for batch queries
    const paperIds = dbPapers.map((p) => p.id);

    // Batch fetch all authors for all papers in one query
    const allPaperAuthors = await db
      .select({
        paperId: paperAuthors.paperId,
        name: authors.name,
        id: authors.id,
        position: paperAuthors.position,
      })
      .from(paperAuthors)
      .innerJoin(authors, eq(paperAuthors.authorId, authors.id))
      .where(inArray(paperAuthors.paperId, paperIds))
      .orderBy(paperAuthors.paperId, paperAuthors.position);

    // Group authors by paper ID
    const authorsByPaperId = new Map<string, { name: string; id: string }[]>();
    for (const author of allPaperAuthors) {
      if (!authorsByPaperId.has(author.paperId)) {
        authorsByPaperId.set(author.paperId, []);
      }
      authorsByPaperId.get(author.paperId)!.push({ name: author.name, id: author.id });
    }

    // Batch fetch all social mentions for all papers
    const allSocialMentions = await db
      .select({
        id: socialMentions.id,
        paperId: socialMentions.paperId,
        platformName: socialPlatforms.name,
        authorHandle: socialMentions.authorHandle,
        authorName: socialMentions.authorName,
        content: socialMentions.content,
        url: socialMentions.url,
        likes: socialMentions.likes,
        reposts: socialMentions.reposts,
        replies: socialMentions.replies,
        postedAt: socialMentions.postedAt,
        engagement: sql<number>`${socialMentions.likes} + ${socialMentions.reposts}`.as("engagement"),
      })
      .from(socialMentions)
      .innerJoin(socialPlatforms, eq(socialMentions.platformId, socialPlatforms.id))
      .where(inArray(socialMentions.paperId, paperIds))
      .orderBy(desc(sql`${socialMentions.likes} + ${socialMentions.reposts}`));

    // Group social mentions by paper ID, limiting to 10 per paper
    const mentionsByPaperId = new Map<string, typeof allSocialMentions>();
    for (const mention of allSocialMentions) {
      if (!mentionsByPaperId.has(mention.paperId)) {
        mentionsByPaperId.set(mention.paperId, []);
      }
      const paperMentions = mentionsByPaperId.get(mention.paperId)!;
      if (paperMentions.length < 10) {
        paperMentions.push(mention);
      }
    }

    // Batch fetch all news mentions for all papers
    const allNewsMentions = await db
      .select({
        id: newsMentions.id,
        paperId: newsMentions.paperId,
        title: newsMentions.title,
        snippet: newsMentions.snippet,
        url: newsMentions.url,
        sourceName: newsMentions.sourceName,
        publishedAt: newsMentions.publishedAt,
        imageUrl: newsMentions.imageUrl,
      })
      .from(newsMentions)
      .where(inArray(newsMentions.paperId, paperIds))
      .orderBy(desc(newsMentions.publishedAt));

    // Group news mentions by paper ID, limiting to 5 per paper
    const newsByPaperId = new Map<string, typeof allNewsMentions>();
    for (const news of allNewsMentions) {
      if (!newsByPaperId.has(news.paperId)) {
        newsByPaperId.set(news.paperId, []);
      }
      const paperNews = newsByPaperId.get(news.paperId)!;
      if (paperNews.length < 5) {
        paperNews.push(news);
      }
    }

    // Batch fetch all analyses for all papers
    const allAnalyses = await db
      .select()
      .from(paperCardAnalyses)
      .where(inArray(paperCardAnalyses.paperId, paperIds));

    // Map analyses by paper ID
    const analysisByPaperId = new Map<string, typeof allAnalyses[0]>();
    for (const analysis of allAnalyses) {
      analysisByPaperId.set(analysis.paperId, analysis);
    }

    // Assemble enriched papers in memory
    const enrichedPapers = dbPapers.map((paper) => {
      const paperAuthorsData = authorsByPaperId.get(paper.id) || [];
      const mentions = mentionsByPaperId.get(paper.id) || [];
      const news = newsByPaperId.get(paper.id) || [];
      const analysis = analysisByPaperId.get(paper.id) || null;

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
          id: m.id,
          platformName: m.platformName,
          authorHandle: m.authorHandle,
          authorName: m.authorName,
          content: m.content,
          url: m.url,
          likes: m.likes,
          reposts: m.reposts,
          replies: m.replies,
          postedAt: m.postedAt?.toISOString() || null,
        })),
        newsMentions: news.map((n) => ({
          id: n.id,
          title: n.title,
          snippet: n.snippet,
          url: n.url,
          sourceName: n.sourceName,
          publishedAt: n.publishedAt?.toISOString() || null,
          imageUrl: n.imageUrl,
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
    });

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
