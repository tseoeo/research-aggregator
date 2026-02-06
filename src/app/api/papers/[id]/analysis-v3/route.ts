/**
 * GET /api/papers/[id]/analysis-v3
 *
 * Get the v3 analysis for a paper.
 * Returns the 10-field analysis with camelCase field names.
 *
 * 200 — analysis found
 * 202 — analysis pending
 * 404 — paper not found
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, paperAnalysesV3, paperAuthors, authors } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    // Check if paper exists (support both UUID and arXiv ID)
    const paper = await db
      .select({
        id: papers.id,
        title: papers.title,
        externalId: papers.externalId,
      })
      .from(papers)
      .where(eq(papers.id, id))
      .limit(1);

    if (paper.length === 0) {
      return NextResponse.json(
        { error: "Paper not found" },
        { status: 404 }
      );
    }

    const paperId = paper[0].id;

    // Get v3 analysis
    const analysis = await db
      .select()
      .from(paperAnalysesV3)
      .where(eq(paperAnalysesV3.paperId, paperId))
      .limit(1);

    if (analysis.length === 0) {
      return NextResponse.json(
        {
          paperId,
          status: "pending",
          message: "V3 analysis not yet available. Paper may be queued for processing.",
        },
        { status: 202 }
      );
    }

    const a = analysis[0];

    // Get author info for Field 10 (Who's Behind This)
    const authorData = await db
      .select({
        name: authors.name,
        position: paperAuthors.position,
        affiliation: paperAuthors.affiliation,
      })
      .from(paperAuthors)
      .innerJoin(authors, eq(paperAuthors.authorId, authors.id))
      .where(eq(paperAuthors.paperId, paperId))
      .orderBy(asc(paperAuthors.position));

    // Build "Who's Behind This" from author data
    const authorCount = authorData.length;
    const firstAuthor = authorData[0];
    const affiliation = firstAuthor?.affiliation || null;
    const whoBehindThis = authorCount > 0
      ? `${affiliation || "Unknown institution"} \u00b7 ${authorCount} author${authorCount !== 1 ? "s" : ""}`
      : null;

    return NextResponse.json({
      paperId,
      paperTitle: paper[0].title,
      status: a.analysisStatus,
      analysis: {
        id: a.id,
        version: a.analysisVersion,
        // Field 1
        hookSentence: a.hookSentence,
        // Field 2
        whatKind: a.whatKind,
        // Field 3
        timeToValue: a.timeToValue,
        // Field 4
        impactAreaTags: a.impactAreaTags,
        // Field 5
        practicalValueScore: a.practicalValueScore,
        practicalValueTotal: a.practicalValueTotal,
        // Field 6
        keyNumbers: a.keyNumbers,
        // Field 7
        readinessLevel: a.readinessLevel,
        // Field 8
        howThisChangesThings: a.howThisChangesThings,
        // Field 9
        whatCameBefore: a.whatCameBefore,
        // Field 10 (from paper metadata)
        whoBehindThis,
        authorCount,
        firstAuthorAffiliation: affiliation,
        // Metadata
        model: a.analysisModel,
        tokensUsed: a.tokensUsed,
        createdAt: a.createdAt?.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching v3 analysis:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch v3 analysis" },
      { status: 500 }
    );
  }
}
