/**
 * Summary Generation Worker
 *
 * Processes jobs to generate AI summaries for papers.
 * This worker should be run as a separate process in production.
 */

import { Worker, Job } from "bullmq";
import { redisConnection } from "../../redis";
import { OpenRouterService } from "../../services/openrouter";
import { db } from "../../db";
import { papers } from "../../db/schema";
import { eq } from "drizzle-orm";

export interface SummaryJobData {
  paperId: string;
  title: string;
  abstract: string;
}

export interface SummaryJobResult {
  paperId: string;
  bullets: string[];
  eli5: string;
  tokensUsed: number;
  model: string;
}

/**
 * Process a summary generation job
 */
async function processSummaryJob(job: Job<SummaryJobData>): Promise<SummaryJobResult> {
  const { paperId, title, abstract } = job.data;

  console.log(`[Summary Worker] Processing paper: ${paperId}`);

  const openRouter = new OpenRouterService();

  if (!openRouter.isConfigured()) {
    throw new Error("OpenRouter API key not configured");
  }

  // Generate summary
  const summary = await openRouter.generateSummary(title, abstract);

  console.log(`[Summary Worker] Generated summary for ${paperId}, tokens used: ${summary.tokensUsed}`);

  // Update paper in database
  try {
    await db
      .update(papers)
      .set({
        summaryBullets: summary.bullets,
        summaryEli5: summary.eli5,
        summaryGeneratedAt: new Date(),
        summaryModel: summary.model,
      })
      .where(eq(papers.id, paperId));

    console.log(`[Summary Worker] Updated paper ${paperId} with summary`);
  } catch (dbError) {
    console.error(`[Summary Worker] Database error for ${paperId}:`, dbError);
    // Don't throw - the summary was generated, just couldn't be saved
    // In production, you might want to handle this differently
  }

  return {
    paperId,
    bullets: summary.bullets,
    eli5: summary.eli5,
    tokensUsed: summary.tokensUsed,
    model: summary.model,
  };
}

/**
 * Create and start the summary worker
 */
export function createSummaryWorker() {
  const worker = new Worker<SummaryJobData, SummaryJobResult>(
    "summary-generation",
    processSummaryJob,
    {
      connection: redisConnection,
      concurrency: 2, // Process 2 jobs at a time
      limiter: {
        max: 10, // Max 10 jobs
        duration: 60000, // Per minute (respect API rate limits)
      },
    }
  );

  worker.on("completed", (job, result) => {
    console.log(`[Summary Worker] Job ${job.id} completed for paper ${result.paperId}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[Summary Worker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("[Summary Worker] Worker error:", err);
  });

  console.log("[Summary Worker] Started");

  return worker;
}

// Export for use in standalone worker process
export { processSummaryJob };
