import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, paperCardAnalyses, paperUseCaseMappings, taxonomyEntries } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ arxivId: string }>;
}

/**
 * GET /api/papers/arxiv/[arxivId]/analysis
 *
 * Get the DTL-P analysis for a paper by its arXiv ID.
 * Returns structured analysis including role, time-to-value, interestingness, etc.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { arxivId } = await params;

    // First find the paper by external (arxiv) ID
    const paper = await db
      .select({ id: papers.id, title: papers.title })
      .from(papers)
      .where(eq(papers.externalId, arxivId))
      .limit(1);

    if (paper.length === 0) {
      return NextResponse.json(
        { error: "Paper not found" },
        { status: 404 }
      );
    }

    const paperId = paper[0].id;

    // Get analysis
    const analysis = await db
      .select()
      .from(paperCardAnalyses)
      .where(eq(paperCardAnalyses.paperId, paperId))
      .limit(1);

    if (analysis.length === 0) {
      return NextResponse.json({
        paperId: paperId,
        paperTitle: paper[0].title,
        analysis: null,
        status: "pending",
        message: "Analysis not yet available. Paper may be queued for processing.",
      });
    }

    const analysisData = analysis[0];

    // Get use-case mappings with taxonomy entry details
    const useCaseMappings = await db
      .select({
        fitConfidence: paperUseCaseMappings.fitConfidence,
        because: paperUseCaseMappings.because,
        evidencePointers: paperUseCaseMappings.evidencePointers,
        useCaseName: taxonomyEntries.name,
        useCaseDefinition: taxonomyEntries.definition,
      })
      .from(paperUseCaseMappings)
      .innerJoin(taxonomyEntries, eq(paperUseCaseMappings.taxonomyEntryId, taxonomyEntries.id))
      .where(eq(paperUseCaseMappings.analysisId, analysisData.id));

    return NextResponse.json({
      paperId: paperId,
      paperTitle: paper[0].title,
      status: "complete",
      analysis: {
        id: analysisData.id,
        version: analysisData.analysisVersion,
        // Core classification
        role: analysisData.role,
        roleConfidence: analysisData.roleConfidence,
        timeToValue: analysisData.timeToValue,
        timeToValueConfidence: analysisData.timeToValueConfidence,
        // Interestingness scoring
        interestingness: analysisData.interestingness,
        // Business impact
        businessPrimitives: analysisData.businessPrimitives,
        keyNumbers: analysisData.keyNumbers,
        // Constraints and risks
        constraints: analysisData.constraints,
        failureModes: analysisData.failureModes,
        whatIsMissing: analysisData.whatIsMissing,
        // Readiness
        readinessLevel: analysisData.readinessLevel,
        readinessJustification: analysisData.readinessJustification,
        readinessEvidencePointers: analysisData.readinessEvidencePointers,
        // Use cases
        useCaseMappings: useCaseMappings.map((m) => ({
          name: m.useCaseName,
          definition: m.useCaseDefinition,
          fitConfidence: m.fitConfidence,
          because: m.because,
          evidencePointers: m.evidencePointers,
        })),
        // Public-facing summaries
        publicViews: analysisData.publicViews,
        // Metadata
        model: analysisData.analysisModel,
        tokensUsed: analysisData.tokensUsed,
        createdAt: analysisData.createdAt?.toISOString(),
        updatedAt: analysisData.updatedAt?.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error fetching analysis:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch analysis" },
      { status: 500 }
    );
  }
}
