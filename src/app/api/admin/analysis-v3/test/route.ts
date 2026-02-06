import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, paperAuthors, authors, analysisBatchJobs } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { verifyAdminAuth } from "@/lib/auth/admin";
import { PaperAnalysisV3Service } from "@/lib/services/paper-analysis-v3";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) return auth.error;

  try {
    const body = await request.json();
    const { paperId, externalId, model } = body;

    if (!paperId && !externalId) {
      return NextResponse.json(
        { error: "Provide paperId (UUID) or externalId (arXiv ID)" },
        { status: 400 }
      );
    }

    // Find the paper
    const paper = await db
      .select()
      .from(papers)
      .where(paperId ? eq(papers.id, paperId) : eq(papers.externalId, externalId))
      .limit(1);

    if (paper.length === 0) {
      return NextResponse.json({ error: "Paper not found" }, { status: 404 });
    }

    const p = paper[0];

    // Get authors
    const authorRows = await db
      .select({ name: authors.name })
      .from(paperAuthors)
      .innerJoin(authors, eq(paperAuthors.authorId, authors.id))
      .where(eq(paperAuthors.paperId, p.id))
      .orderBy(asc(paperAuthors.position));

    const authorNames = authorRows.map((a) => a.name);

    // Run analysis synchronously
    const service = new PaperAnalysisV3Service(
      process.env.OPENROUTER_API_KEY,
      model || process.env.OPENROUTER_MODEL
    );

    if (!service.isConfigured()) {
      return NextResponse.json(
        { error: "OpenRouter API key not configured" },
        { status: 503 }
      );
    }

    const startTime = Date.now();
    const result = await service.analyzePaper({
      title: p.title,
      abstract: p.abstract || "",
      authors: authorNames,
      publishedDate: p.publishedAt?.toISOString()?.split("T")[0],
      categories: p.categories || [],
    });
    const processingTimeMs = Date.now() - startTime;

    // Estimate cost (rough: $0.01 per 1000 tokens for kimi-k2.5)
    const costCents = Math.max(1, Math.round(result.tokensUsed * 0.001));

    // Track as a batch job for cost averaging
    await db.insert(analysisBatchJobs).values({
      paperId: p.id,
      status: "completed",
      costCents,
      tokensUsed: result.tokensUsed,
      processingTimeMs,
      completedAt: new Date(),
    });

    return NextResponse.json({
      paper: {
        id: p.id,
        externalId: p.externalId,
        title: p.title,
      },
      analysis: result.analysis,
      analysisStatus: result.analysisStatus,
      validationErrors: result.validationErrors,
      cost: {
        tokensUsed: result.tokensUsed,
        costCents,
        costDollars: `$${(costCents / 100).toFixed(3)}`,
        processingTimeMs,
        processingTimeSeconds: (processingTimeMs / 1000).toFixed(1),
      },
      model: result.model,
    });
  } catch (error) {
    console.error("[AnalysisV3 Test] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Test analysis failed" },
      { status: 500 }
    );
  }
}
