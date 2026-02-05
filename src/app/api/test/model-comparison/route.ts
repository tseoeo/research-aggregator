import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { OpenRouterService } from "@/lib/services/openrouter";
import { PaperAnalysisService } from "@/lib/services/paper-analysis";

export const dynamic = "force-dynamic";
export const maxDuration = 120; // 2 minutes max for AI calls

// AI processing toggle - set AI_ENABLED=true to enable AI calls
const AI_ENABLED = process.env.AI_ENABLED === "true";

interface RequestBody {
  paperId: string;
  model: string;
  runSummary?: boolean;
  runAnalysis?: boolean;
}

/**
 * POST /api/test/model-comparison
 *
 * Run AI summary and/or analysis for a paper with a specific model.
 * Used for comparing model outputs and costs.
 */
export async function POST(request: NextRequest) {
  if (!AI_ENABLED) {
    return NextResponse.json(
      { error: "AI processing is currently paused (AI_ENABLED=false)" },
      { status: 503 }
    );
  }

  try {
    const body: RequestBody = await request.json();
    const { paperId, model, runSummary = true, runAnalysis = true } = body;

    if (!paperId || !model) {
      return NextResponse.json(
        { error: "paperId and model are required" },
        { status: 400 }
      );
    }

    // Fetch paper from database
    const paper = await db
      .select({
        id: papers.id,
        title: papers.title,
        abstract: papers.abstract,
        publishedAt: papers.publishedAt,
      })
      .from(papers)
      .where(eq(papers.id, paperId))
      .limit(1);

    if (paper.length === 0) {
      return NextResponse.json(
        { error: "Paper not found" },
        { status: 404 }
      );
    }

    const { title, abstract, publishedAt } = paper[0];

    if (!title || !abstract) {
      return NextResponse.json(
        { error: "Paper missing title or abstract" },
        { status: 400 }
      );
    }

    console.log(`[ModelComparison] Starting comparison for paper "${title.substring(0, 50)}..." with model ${model}`);

    const result: {
      model: string;
      summary?: {
        bullets: string[];
        eli5: string;
        tokensUsed: number;
      };
      analysis?: {
        role: string;
        roleConfidence: number;
        timeToValue: string;
        timeToValueConfidence: number;
        interestingness: unknown;
        businessPrimitives: unknown;
        keyNumbers: unknown[];
        constraints: unknown[];
        failureModes: unknown[];
        whatIsMissing: string[];
        readinessLevel: string;
        readinessJustification: string;
        readinessEvidencePointers: string[];
        useCaseMappings: unknown[];
        publicViews: unknown;
        tokensUsed: number;
      };
      summaryTokens: number;
      analysisTokens: number;
      totalTokens: number;
      summaryDuration: number;
      analysisDuration: number;
      error?: string;
    } = {
      model,
      summaryTokens: 0,
      analysisTokens: 0,
      totalTokens: 0,
      summaryDuration: 0,
      analysisDuration: 0,
    };

    // Run summary generation
    if (runSummary) {
      try {
        console.log(`[ModelComparison] [AI-CALL] Running summary with ${model}`);
        const summaryStart = Date.now();

        const openRouterService = new OpenRouterService(undefined, model);
        const summaryResult = await openRouterService.generateSummary(title, abstract);

        result.summaryDuration = Date.now() - summaryStart;
        result.summary = {
          bullets: summaryResult.bullets,
          eli5: summaryResult.eli5,
          tokensUsed: summaryResult.tokensUsed,
        };
        result.summaryTokens = summaryResult.tokensUsed;

        console.log(`[ModelComparison] Summary complete: ${summaryResult.tokensUsed} tokens in ${result.summaryDuration}ms`);
      } catch (error) {
        console.error(`[ModelComparison] Summary error:`, error);
        result.error = `Summary failed: ${error instanceof Error ? error.message : "Unknown error"}`;
      }
    }

    // Run DTL-P analysis
    if (runAnalysis) {
      try {
        console.log(`[ModelComparison] [AI-CALL] Running analysis with ${model}`);
        const analysisStart = Date.now();

        const analysisService = new PaperAnalysisService(undefined, model);
        const analysisResult = await analysisService.analyzePaper({
          title,
          abstract,
          year: publishedAt?.getFullYear(),
        });

        result.analysisDuration = Date.now() - analysisStart;
        result.analysis = {
          role: analysisResult.analysis.role,
          roleConfidence: analysisResult.analysis.role_confidence,
          timeToValue: analysisResult.analysis.time_to_value,
          timeToValueConfidence: analysisResult.analysis.time_to_value_confidence,
          interestingness: analysisResult.analysis.interestingness,
          businessPrimitives: analysisResult.analysis.business_primitives,
          keyNumbers: analysisResult.analysis.key_numbers,
          constraints: analysisResult.analysis.constraints,
          failureModes: analysisResult.analysis.failure_modes,
          whatIsMissing: analysisResult.analysis.what_is_missing,
          readinessLevel: analysisResult.analysis.readiness_level,
          readinessJustification: analysisResult.analysis.readiness_justification,
          readinessEvidencePointers: analysisResult.analysis.readiness_evidence_pointers,
          useCaseMappings: analysisResult.analysis.use_case_mapping.map(m => ({
            name: m.use_case_name,
            fitConfidence: m.fit_confidence,
            because: m.because,
            evidencePointers: m.evidence_pointers,
          })),
          publicViews: analysisResult.analysis.public_views,
          tokensUsed: analysisResult.tokensUsed,
        };
        result.analysisTokens = analysisResult.tokensUsed;

        console.log(`[ModelComparison] Analysis complete: ${analysisResult.tokensUsed} tokens in ${result.analysisDuration}ms`);
      } catch (error) {
        console.error(`[ModelComparison] Analysis error:`, error);
        if (!result.error) {
          result.error = `Analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`;
        } else {
          result.error += ` | Analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`;
        }
      }
    }

    result.totalTokens = result.summaryTokens + result.analysisTokens;

    console.log(`[ModelComparison] Complete: ${result.totalTokens} total tokens (summary: ${result.summaryTokens}, analysis: ${result.analysisTokens})`);

    return NextResponse.json(result);
  } catch (error) {
    console.error("[ModelComparison] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
