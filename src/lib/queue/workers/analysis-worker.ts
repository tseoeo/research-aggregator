/**
 * Paper Analysis Worker (DTL-P)
 *
 * Processes jobs to generate structured paper card analyses.
 * Implements the Deterministic Translation Layer for Public audiences.
 */

import { Worker, Job } from "bullmq";
import { redisConnection } from "../../redis";
import { PaperAnalysisService, type PaperCardAnalysisResponse } from "../../services/paper-analysis";
import { db } from "../../db";
import {
  paperCardAnalyses,
  taxonomyEntries,
  paperUseCaseMappings,
} from "../../db/schema";
import { eq, and, sql } from "drizzle-orm";

const ANALYSIS_VERSION = "dtlp_v1";

export interface AnalysisJobData {
  paperId: string;
  title: string;
  abstract: string;
  authors?: string[];
  year?: number;
  force?: boolean; // Force re-analysis even if exists
}

export interface AnalysisJobResult {
  paperId: string;
  analysisId: string;
  role: string;
  timeToValue: string;
  interestScore: number;
  interestTier: string;
  useCasesMapped: number;
  tokensUsed: number;
  model: string;
}

/**
 * Process a paper analysis job
 */
async function processAnalysisJob(job: Job<AnalysisJobData>): Promise<AnalysisJobResult> {
  const { paperId, title, abstract, authors, year, force = false } = job.data;

  console.log(`[Analysis Worker] Processing paper: ${paperId}`);

  // Check if analysis already exists (idempotency)
  if (!force) {
    const existing = await db
      .select({ id: paperCardAnalyses.id, version: paperCardAnalyses.analysisVersion })
      .from(paperCardAnalyses)
      .where(eq(paperCardAnalyses.paperId, paperId))
      .limit(1);

    if (existing.length > 0 && existing[0].version === ANALYSIS_VERSION) {
      console.log(`[Analysis Worker] Analysis already exists for ${paperId}, skipping`);
      return {
        paperId,
        analysisId: existing[0].id,
        role: "skipped",
        timeToValue: "skipped",
        interestScore: 0,
        interestTier: "skipped",
        useCasesMapped: 0,
        tokensUsed: 0,
        model: "none",
      };
    }
  }

  const analysisService = new PaperAnalysisService();

  if (!analysisService.isConfigured()) {
    throw new Error("OpenRouter API key not configured");
  }

  // Generate analysis
  const { analysis, tokensUsed, model } = await analysisService.analyzePaper({
    title,
    abstract,
    authors,
    year,
  });

  console.log(
    `[Analysis Worker] Generated analysis for ${paperId}: ` +
    `role=${analysis.role}, ttv=${analysis.time_to_value}, ` +
    `score=${analysis.interestingness.total_score}, tokens=${tokensUsed}`
  );

  // Delete existing analysis if force re-run
  if (force) {
    await db.delete(paperCardAnalyses).where(eq(paperCardAnalyses.paperId, paperId));
  }

  // Insert analysis
  const insertResult = await db
    .insert(paperCardAnalyses)
    .values({
      paperId,
      analysisVersion: ANALYSIS_VERSION,
      role: analysis.role,
      roleConfidence: analysis.role_confidence,
      timeToValue: analysis.time_to_value,
      timeToValueConfidence: analysis.time_to_value_confidence,
      interestingness: analysis.interestingness,
      businessPrimitives: analysis.business_primitives,
      keyNumbers: analysis.key_numbers,
      constraints: analysis.constraints,
      failureModes: analysis.failure_modes,
      whatIsMissing: analysis.what_is_missing,
      readinessLevel: analysis.readiness_level,
      readinessJustification: analysis.readiness_justification,
      readinessEvidencePointers: analysis.readiness_evidence_pointers,
      publicViews: analysis.public_views,
      taxonomyProposals: analysis.taxonomy_proposals.length > 0 ? analysis.taxonomy_proposals : null,
      analysisModel: model,
      tokensUsed,
    })
    .returning({ id: paperCardAnalyses.id });

  const analysisId = insertResult[0].id;
  console.log(`[Analysis Worker] Saved analysis ${analysisId} for paper ${paperId}`);

  // Process use-case mappings
  let useCasesMapped = 0;
  for (const mapping of analysis.use_case_mapping) {
    try {
      // Find taxonomy entry by name
      const taxonomyEntry = await db
        .select({ id: taxonomyEntries.id })
        .from(taxonomyEntries)
        .where(eq(taxonomyEntries.name, mapping.use_case_name))
        .limit(1);

      if (taxonomyEntry.length > 0) {
        // Insert mapping
        await db.insert(paperUseCaseMappings).values({
          analysisId,
          taxonomyEntryId: taxonomyEntry[0].id,
          fitConfidence: mapping.fit_confidence,
          because: mapping.because,
          evidencePointers: mapping.evidence_pointers,
        });

        // Increment usage count
        await db
          .update(taxonomyEntries)
          .set({ usageCount: sql`${taxonomyEntries.usageCount} + 1` })
          .where(eq(taxonomyEntries.id, taxonomyEntry[0].id));

        useCasesMapped++;
      } else {
        console.warn(`[Analysis Worker] Taxonomy entry not found: ${mapping.use_case_name}`);
      }
    } catch (mappingError) {
      console.error(`[Analysis Worker] Failed to map use-case:`, mappingError);
    }
  }

  // Process taxonomy proposals (save as provisional)
  for (const proposal of analysis.taxonomy_proposals) {
    try {
      await db
        .insert(taxonomyEntries)
        .values({
          type: proposal.type,
          name: proposal.proposed_name,
          definition: proposal.definition,
          inclusions: proposal.inclusions,
          exclusions: proposal.exclusions,
          examples: proposal.examples,
          synonyms: proposal.synonyms,
          status: "provisional", // Always provisional
          usageCount: 0,
          version: 1,
        })
        .onConflictDoNothing(); // Don't error if already proposed

      console.log(`[Analysis Worker] Created provisional taxonomy entry: ${proposal.proposed_name}`);
    } catch (proposalError) {
      console.error(`[Analysis Worker] Failed to create proposal:`, proposalError);
    }
  }

  console.log(
    `[Analysis Worker] Completed analysis for ${paperId}: ` +
    `${useCasesMapped} use-cases mapped, ${analysis.taxonomy_proposals.length} proposals`
  );

  return {
    paperId,
    analysisId,
    role: analysis.role,
    timeToValue: analysis.time_to_value,
    interestScore: analysis.interestingness.total_score,
    interestTier: analysis.interestingness.tier,
    useCasesMapped,
    tokensUsed,
    model,
  };
}

/**
 * Create and start the analysis worker
 */
export function createAnalysisWorker() {
  const worker = new Worker<AnalysisJobData, AnalysisJobResult>(
    "paper-analysis",
    processAnalysisJob,
    {
      connection: redisConnection,
      concurrency: 1, // One at a time - analysis is expensive
      limiter: {
        max: 5, // Max 5 jobs per minute
        duration: 60000,
      },
    }
  );

  worker.on("completed", (job, result) => {
    console.log(
      `[Analysis Worker] Job ${job.id} completed: ` +
      `paper=${result.paperId}, role=${result.role}, score=${result.interestScore}`
    );
  });

  worker.on("failed", (job, err) => {
    console.error(`[Analysis Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("[Analysis Worker] Worker error:", err);
  });

  console.log("[Analysis Worker] Started");

  return worker;
}

// Export for use in standalone worker process
export { processAnalysisJob };
