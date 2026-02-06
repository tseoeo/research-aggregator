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
import { paperAnalysesV3, papers, paperAuthors, authors, analysisBatches, analysisBatchJobs } from "../../db/schema";
import { eq, and, sql } from "drizzle-orm";

const ANALYSIS_VERSION = "v3";

export interface AnalysisV3JobData {
  paperId: string;
  batchId?: string;
  title?: string;
  abstract?: string;
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
  const { paperId, batchId, force = false, model: requestedModel } = job.data;
  let { title, abstract, authors: authorNames, publishedDate, categories } = job.data;

  const jobStartTime = Date.now();

  // Mark batch job as running
  if (batchId) {
    await db
      .update(analysisBatchJobs)
      .set({ status: "running" })
      .where(
        and(
          eq(analysisBatchJobs.batchId, batchId),
          eq(analysisBatchJobs.paperId, paperId)
        )
      );
  }

  console.log(`[AnalysisV3 Worker] Processing paper: ${paperId}${requestedModel ? ` with model: ${requestedModel}` : ""}`);

  // Fetch paper data from DB if not provided in job payload
  if (!title || !abstract) {
    const paperRow = await db
      .select({
        title: papers.title,
        abstract: papers.abstract,
        publishedAt: papers.publishedAt,
        categories: papers.categories,
      })
      .from(papers)
      .where(eq(papers.id, paperId))
      .limit(1);

    if (paperRow.length === 0) {
      throw new Error(`Paper ${paperId} not found in database`);
    }

    title = paperRow[0].title;
    abstract = paperRow[0].abstract || "";
    publishedDate = publishedDate || paperRow[0].publishedAt?.toISOString().split("T")[0];
    categories = categories || paperRow[0].categories || [];

    // Fetch authors if not provided
    if (!authorNames || authorNames.length === 0) {
      const authorRows = await db
        .select({ name: authors.name })
        .from(paperAuthors)
        .innerJoin(authors, eq(paperAuthors.authorId, authors.id))
        .where(eq(paperAuthors.paperId, paperId));
      authorNames = authorRows.map((r) => r.name);
    }
  }

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
  const processingTimeMs = Date.now() - jobStartTime;
  console.log(`[AnalysisV3 Worker] Saved analysis ${analysisId} for paper ${paperId}`);

  // Update batch job tracking
  if (batchId) {
    await updateBatchJobCompleted(batchId, paperId, result.tokensUsed, processingTimeMs);
  }

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
 * Update batch job record on completion and check if batch is done
 */
async function updateBatchJobCompleted(batchId: string, paperId: string, tokensUsed: number, processingTimeMs: number) {
  try {
    await db
      .update(analysisBatchJobs)
      .set({
        status: "completed",
        tokensUsed,
        processingTimeMs,
        completedAt: new Date(),
      })
      .where(
        and(
          eq(analysisBatchJobs.batchId, batchId),
          eq(analysisBatchJobs.paperId, paperId)
        )
      );

    // Increment batch completed counter and check if done
    await db
      .update(analysisBatches)
      .set({
        completed: sql`${analysisBatches.completed} + 1`,
        totalTokens: sql`${analysisBatches.totalTokens} + ${tokensUsed}`,
      })
      .where(eq(analysisBatches.id, batchId));

    await checkBatchDone(batchId);
  } catch (err) {
    console.error(`[AnalysisV3 Worker] Failed to update batch job tracking:`, err);
  }
}

/**
 * Update batch job record on failure and check if batch is done
 */
async function updateBatchJobFailed(batchId: string, paperId: string, errorMessage: string) {
  try {
    await db
      .update(analysisBatchJobs)
      .set({
        status: "failed",
        errorMessage,
        completedAt: new Date(),
      })
      .where(
        and(
          eq(analysisBatchJobs.batchId, batchId),
          eq(analysisBatchJobs.paperId, paperId)
        )
      );

    await db
      .update(analysisBatches)
      .set({ failed: sql`${analysisBatches.failed} + 1` })
      .where(eq(analysisBatches.id, batchId));

    await checkBatchDone(batchId);
  } catch (err) {
    console.error(`[AnalysisV3 Worker] Failed to update batch job failure:`, err);
  }
}

/**
 * Check if all jobs in a batch are done, and mark batch as completed if so
 */
async function checkBatchDone(batchId: string) {
  const batch = await db
    .select({
      batchSize: analysisBatches.batchSize,
      completed: analysisBatches.completed,
      failed: analysisBatches.failed,
      status: analysisBatches.status,
    })
    .from(analysisBatches)
    .where(eq(analysisBatches.id, batchId))
    .limit(1);

  if (batch.length === 0) return;

  const { batchSize, completed, failed, status } = batch[0];
  if (status !== "running") return;

  if (completed + failed >= batchSize) {
    await db
      .update(analysisBatches)
      .set({ status: "completed", finishedAt: new Date() })
      .where(eq(analysisBatches.id, batchId));
    console.log(`[AnalysisV3 Worker] Batch ${batchId} completed: ${completed} succeeded, ${failed} failed`);
  }
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

  worker.on("failed", async (job, err) => {
    console.error(`[AnalysisV3 Worker] Job ${job?.id} failed:`, err.message);
    // Update batch job tracking on failure
    if (job?.data?.batchId && job?.data?.paperId) {
      await updateBatchJobFailed(job.data.batchId, job.data.paperId, err.message);
    }
  });

  worker.on("error", (err) => {
    console.error("[AnalysisV3 Worker] Worker error:", err);
  });

  console.log("[AnalysisV3 Worker] Started");

  return worker;
}

export { processAnalysisV3Job };
