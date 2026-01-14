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
  paperUseCaseMappings,
  taxonomyEntries,
} from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/papers/[id]
 *
 * Fetch a single paper with all related data including DTL-P analysis.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Get paper
    const paperResult = await db
      .select()
      .from(papers)
      .where(eq(papers.id, id))
      .limit(1);

    if (paperResult.length === 0) {
      return NextResponse.json(
        { error: "Paper not found" },
        { status: 404 }
      );
    }

    const paper = paperResult[0];

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

    // Get DTL-P analysis
    const analysisResult = await db
      .select()
      .from(paperCardAnalyses)
      .where(eq(paperCardAnalyses.paperId, paper.id))
      .limit(1);

    let analysis = null;
    if (analysisResult.length > 0) {
      const analysisData = analysisResult[0];

      // Get use-case mappings
      const useCaseMappings = await db
        .select({
          fitConfidence: paperUseCaseMappings.fitConfidence,
          because: paperUseCaseMappings.because,
          useCaseName: taxonomyEntries.name,
        })
        .from(paperUseCaseMappings)
        .innerJoin(taxonomyEntries, eq(paperUseCaseMappings.taxonomyEntryId, taxonomyEntries.id))
        .where(eq(paperUseCaseMappings.analysisId, analysisData.id));

      analysis = {
        role: analysisData.role,
        roleConfidence: analysisData.roleConfidence,
        timeToValue: analysisData.timeToValue,
        timeToValueConfidence: analysisData.timeToValueConfidence,
        interestingness: analysisData.interestingness,
        businessPrimitives: analysisData.businessPrimitives,
        keyNumbers: analysisData.keyNumbers,
        constraints: analysisData.constraints,
        failureModes: analysisData.failureModes,
        readinessLevel: analysisData.readinessLevel,
        useCaseMappings: useCaseMappings.map((m) => ({
          name: m.useCaseName,
          fitConfidence: m.fitConfidence,
          because: m.because,
        })),
        publicViews: analysisData.publicViews,
      };
    }

    return NextResponse.json({
      id: paper.id,
      externalId: paper.externalId,
      title: paper.title,
      abstract: paper.abstract,
      publishedAt: paper.publishedAt?.toISOString() || null,
      updatedAt: paper.updatedAt?.toISOString() || null,
      primaryCategory: paper.primaryCategory,
      categories: paper.categories,
      pdfUrl: paper.pdfUrl,
      // Legacy summaries
      summaryBullets: paper.summaryBullets,
      summaryEli5: paper.summaryEli5,
      // Authors
      authors: paperAuthorsData,
      // Social and news
      socialMentions: mentions.map((m) => ({
        ...m,
        postedAt: m.postedAt?.toISOString() || null,
      })),
      newsMentions: news.map((n) => ({
        ...n,
        publishedAt: n.publishedAt?.toISOString() || null,
      })),
      // DTL-P analysis (null if not yet processed)
      analysis,
    });
  } catch (error) {
    console.error("Error fetching paper:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch paper" },
      { status: 500 }
    );
  }
}
