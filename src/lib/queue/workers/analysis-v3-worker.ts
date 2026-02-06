/**
 * Paper Analysis V3 Worker
 *
 * Processes jobs to generate the 10-field v3 paper analysis.
 * Runs alongside the old DTL-P worker — does NOT replace it.
 */

import { Worker, Job } from "bullmq";
import { redisConnection } from "../../redis";
import { PaperAnalysisV3Service } from "../../services/paper-analysis-v3";
import { db } from "../../db";
import { paperAnalysesV3, papers, paperAuthors, authors } from "../../db/schema";
import { eq, and } from "drizzle-orm";
const ANALYSIS_VERSION = "v3";

export interface AnalysisV3JobData {
  paperId: string;
  title: string;
  abstract: string;
  authors?: string[];
  publishedDate?: string;
  categories?: string[];
  force?: boolean;
  model?: string;
}

export interface AnalysisV3JobResult {
  paperId: string;
  analysisId: string;
  whatKind: string;
  practicalValueTotal: number;
  readinessLevel: string;
  tokensUsed: number;
  model: string;
  analysisStatus: string;
}

/**
 * Process a v3 analysis job
 */
async function processAnalysisV3Job(job: Job<AnalysisV3JobData>): Promise<AnalysisV3JobResult> {
  const { paperId, title, abstract, authors: authorNames, publishedDate, categories, force = false, model: requestedModel } = job.data;

  console.log(`[AnalysisV3 Worker] Processing paper: ${paperId}${requestedModel ? ` with model: ${requestedModel}` : ""}`);

  const analysisService = new PaperAnalysisV3Service(undefined, requestedModel);

  if (!analysisService.isConfigured()) {
    throw new Error("OpenRouter API key not configured");
  }

  // Idempotency check — skip if analysis already exists for this version
  if (!force) {
    const existing = await db
      .select({
        id: paperAnalysesV3.id,
        version: paperAnalysesV3.analysisVersion,
      })
      .from(paperAnalysesV3)
      .where(
        and(
          eq(paperAnalysesV3.paperId, paperId),
          eq(paperAnalysesV3.analysisVersion, ANALYSIS_VERSION)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      console.log(`[AnalysisV3 Worker] Analysis already exists for ${paperId} (${ANALYSIS_VERSION}), skipping`);
      return {
        paperId,
        analysisId: existing[0].id,
        whatKind: "skipped",
        practicalValueTotal: 0,
        readinessLevel: "skipped",
        tokensUsed: 0,
        model: "none",
        analysisStatus: "skipped",
      };
    }
  }

  // Generate analysis
  const result = await analysisService.analyzePaper({
    title,
    abstract,
    authors: authorNames,
    publishedDate,
    categories,
  });

  const { analysis } = result;

  console.log(
    `[AnalysisV3 Worker] Generated analysis for ${paperId}: ` +
    `kind=${analysis.what_kind}, value=${analysis.practical_value_score.total}/6, ` +
    `readiness=${analysis.readiness_level}, tokens=${result.tokensUsed}, status=${result.analysisStatus}`
  );

  // Delete existing analysis if force re-run
  if (force) {
    const existingToDelete = await db
      .select({ id: paperAnalysesV3.id })
      .from(paperAnalysesV3)
      .where(
        and(
          eq(paperAnalysesV3.paperId, paperId),
          eq(paperAnalysesV3.analysisVersion, ANALYSIS_VERSION)
        )
      )
      .limit(1);

    if (existingToDelete.length > 0) {
      console.log(`[AnalysisV3 Worker] Deleting existing analysis for ${paperId} (force re-run)`);
      await db.delete(paperAnalysesV3).where(eq(paperAnalysesV3.id, existingToDelete[0].id));
    }
  }

  // Insert new analysis
  const insertResult = await db
    .insert(paperAnalysesV3)
    .values({
      paperId,
      hookSentence: analysis.hook_sentence,
      whatKind: analysis.what_kind,
      timeToValue: analysis.time_to_value,
      impactAreaTags: analysis.impact_area_tags,
      practicalValueScore: analysis.practical_value_score,
      practicalValueTotal: analysis.practical_value_score.total,
      keyNumbers: analysis.key_numbers,
      readinessLevel: analysis.readiness_level,
      howThisChangesThings: analysis.how_this_changes_things,
      whatCameBefore: analysis.what_came_before,
      analysisVersion: ANALYSIS_VERSION,
      analysisStatus: result.analysisStatus,
      analysisModel: result.model,
      tokensUsed: result.tokensUsed,
      promptHash: result.promptHash,
    })
    .returning({ id: paperAnalysesV3.id });

  const analysisId = insertResult[0].id;
  console.log(`[AnalysisV3 Worker] Saved analysis ${analysisId} for paper ${paperId}`);

  return {
    paperId,
    analysisId,
    whatKind: analysis.what_kind,
    practicalValueTotal: analysis.practical_value_score.total,
    readinessLevel: analysis.readiness_level,
    tokensUsed: result.tokensUsed,
    model: result.model,
    analysisStatus: result.analysisStatus,
  };
}

/**
 * Create and start the v3 analysis worker
 */
export function createAnalysisV3Worker() {
  const worker = new Worker<AnalysisV3JobData, AnalysisV3JobResult>(
    "paper-analysis-v3",
    processAnalysisV3Job,
    {
      connection: redisConnection,
      concurrency: 1,
      limiter: {
        max: 5,
        duration: 60000,
      },
    }
  );

  worker.on("completed", (job, result) => {
    console.log(
      `[AnalysisV3 Worker] Job ${job.id} completed: ` +
      `paper=${result.paperId}, kind=${result.whatKind}, value=${result.practicalValueTotal}/6`
    );
  });

  worker.on("failed", (job, err) => {
    console.error(`[AnalysisV3 Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("[AnalysisV3 Worker] Worker error:", err);
  });

  console.log("[AnalysisV3 Worker] Started");

  return worker;
}

export { processAnalysisV3Job };
