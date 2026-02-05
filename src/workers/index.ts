/**
 * Main Worker Process
 *
 * Entry point for running all background job workers.
 * Run this as a separate process on Railway.
 *
 * Usage: npx tsx src/workers/index.ts
 */

import { Worker } from "bullmq";
import {
  createArxivWorker,
  createSummaryWorker,
  createSocialMonitorWorker,
  createNewsWorker,
  createAnalysisWorker,
  createBackfillWorker,
} from "../lib/queue/workers";
import { arxivFetchQueue, socialMonitorQueue, newsFetchQueue, summaryQueue, analysisQueue } from "../lib/queue/queues";
import { db } from "../lib/db";
import { papers, paperCardAnalyses } from "../lib/db/schema";
import { desc, gte, isNull, eq } from "drizzle-orm";

// Track all workers for graceful shutdown
const workers: Worker[] = [];

// AI processing toggle - set AI_ENABLED=true to enable AI summaries and analyses
const AI_ENABLED = process.env.AI_ENABLED === "true";

/**
 * Schedule recurring arXiv fetch jobs
 *
 * Note: arXiv publishes new papers around 21:00 UTC on weekdays.
 * We schedule the fetch for 22:00 UTC to allow time for processing.
 */
async function scheduleJobs() {
  // Schedule arXiv fetch daily at 22:00 UTC (1 hour after arXiv publishes)
  const existingJobs = await arxivFetchQueue.getRepeatableJobs();

  // Remove any existing repeatable jobs first
  for (const job of existingJobs) {
    await arxivFetchQueue.removeRepeatableByKey(job.key);
  }

  // Add new repeatable job - fetch from ALL AI categories
  // Schedule: Once daily at 22:00 UTC (1 hour after arXiv publishes new papers)
  await arxivFetchQueue.add(
    "fetch-all-ai",
    {
      useAllAICategories: true,
      maxResults: 200, // Increased to catch all new papers (AI categories can have 150-300/day)
    },
    {
      repeat: {
        pattern: "0 22 * * *", // Daily at 22:00 UTC (after arXiv publishes at ~21:00 UTC)
      },
    }
  );

  console.log("[Scheduler] Scheduled arXiv fetch job for all AI categories (daily at 22:00 UTC)");

  // Also run immediately on startup
  await arxivFetchQueue.add(
    "fetch-all-ai-startup",
    {
      useAllAICategories: true,
      maxResults: 200, // Same as scheduled fetch to ensure we don't miss papers
    },
    {
      delay: 5000, // Wait 5 seconds for workers to be ready
    }
  );

  console.log("[Scheduler] Queued initial arXiv fetch for all AI categories (200 papers)");

  // Schedule daily refresh for social mentions and news
  // This will re-fetch for papers from the last 7 days
  scheduleDailyRefresh();
}

/**
 * Schedule daily refresh of social mentions and news for recent papers
 */
async function scheduleDailyRefresh() {
  // Run daily at midnight
  const runDailyRefresh = async () => {
    console.log("[DailyRefresh] Starting daily refresh of social mentions and news...");

    try {
      // Get papers from the last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const recentPapers = await db
        .select({
          id: papers.id,
          externalId: papers.externalId,
          title: papers.title,
        })
        .from(papers)
        .where(gte(papers.createdAt, sevenDaysAgo))
        .orderBy(desc(papers.createdAt))
        .limit(100);

      console.log(`[DailyRefresh] Found ${recentPapers.length} papers to refresh`);

      // Queue social monitor and news fetch jobs for each paper
      for (let i = 0; i < recentPapers.length; i++) {
        const paper = recentPapers[i];

        // Queue social monitoring with delay to respect rate limits
        await socialMonitorQueue.add(
          "refresh-social",
          {
            paperId: paper.id,
            arxivId: paper.externalId,
            title: paper.title,
          },
          { delay: i * 3000 } // 3 seconds between each
        );

        // Queue news fetch with delay
        await newsFetchQueue.add(
          "refresh-news",
          {
            paperId: paper.id,
            arxivId: paper.externalId,
            title: paper.title,
            priority: "low",
          },
          { delay: i * 5000 } // 5 seconds between each
        );
      }

      console.log(`[DailyRefresh] Queued ${recentPapers.length} refresh jobs`);
    } catch (error) {
      console.error("[DailyRefresh] Error:", error);
    }
  };

  // Calculate time until next midnight
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setDate(nextMidnight.getDate() + 1);
  nextMidnight.setHours(0, 0, 0, 0);
  const msUntilMidnight = nextMidnight.getTime() - now.getTime();

  // Schedule first run at next midnight, then every 24 hours
  setTimeout(() => {
    runDailyRefresh();
    // Then run every 24 hours
    setInterval(runDailyRefresh, 24 * 60 * 60 * 1000);
  }, msUntilMidnight);

  console.log(`[Scheduler] Daily refresh scheduled (next run in ${Math.round(msUntilMidnight / 1000 / 60)} minutes)`);
}

/**
 * Backfill existing papers that are missing summaries or analyses
 */
async function backfillMissingAI() {
  console.log("[Backfill] Checking for papers missing summaries or analyses...");

  try {
    // Find papers without summaries (limit to recent 50 to avoid overwhelming the queue)
    const papersWithoutSummaries = await db
      .select({
        id: papers.id,
        externalId: papers.externalId,
        title: papers.title,
        abstract: papers.abstract,
      })
      .from(papers)
      .where(isNull(papers.summaryGeneratedAt))
      .orderBy(desc(papers.createdAt))
      .limit(50);

    console.log(`[Backfill] Found ${papersWithoutSummaries.length} papers without summaries`);

    // Queue summary jobs with staggered delays
    for (let i = 0; i < papersWithoutSummaries.length; i++) {
      const paper = papersWithoutSummaries[i];
      await summaryQueue.add(
        "backfill-summary",
        {
          paperId: paper.id,
          title: paper.title,
          abstract: paper.abstract,
        },
        { delay: i * 3000 } // 3s between jobs
      );
    }

    // Find papers without analyses
    const papersWithoutAnalyses = await db
      .select({
        id: papers.id,
        title: papers.title,
        abstract: papers.abstract,
        publishedAt: papers.publishedAt,
      })
      .from(papers)
      .leftJoin(paperCardAnalyses, eq(papers.id, paperCardAnalyses.paperId))
      .where(isNull(paperCardAnalyses.id))
      .orderBy(desc(papers.createdAt))
      .limit(50);

    console.log(`[Backfill] Found ${papersWithoutAnalyses.length} papers without analyses`);

    // Queue analysis jobs with staggered delays (longer delay - analysis is expensive)
    for (let i = 0; i < papersWithoutAnalyses.length; i++) {
      const paper = papersWithoutAnalyses[i];
      await analysisQueue.add(
        "backfill-analysis",
        {
          paperId: paper.id,
          title: paper.title,
          abstract: paper.abstract,
          year: paper.publishedAt?.getFullYear(),
        },
        { delay: i * 15000 } // 15s between jobs (analysis uses more tokens)
      );
    }

    console.log(`[Backfill] Queued ${papersWithoutSummaries.length} summaries and ${papersWithoutAnalyses.length} analyses`);
  } catch (error) {
    console.error("[Backfill] Error:", error);
  }
}

/**
 * Start all workers
 */
async function startWorkers() {
  console.log("=".repeat(50));
  console.log("Starting Research Aggregator Workers");
  console.log("=".repeat(50));

  // Create and start workers
  workers.push(createArxivWorker());
  workers.push(createSocialMonitorWorker());
  workers.push(createNewsWorker());
  workers.push(createBackfillWorker());

  // Only start AI workers if AI is enabled
  if (AI_ENABLED) {
    workers.push(createSummaryWorker());
    workers.push(createAnalysisWorker());
    console.log("[Main] [AI] Started AI workers (summary + analysis)");
  } else {
    console.log("[Main] [AI] AI workers NOT started (AI_ENABLED=false)");
  }

  console.log(`\n[Main] Started ${workers.length} workers (AI: ${AI_ENABLED ? "ON" : "OFF"})`);

  // Schedule recurring jobs
  await scheduleJobs();

  // Backfill missing summaries and analyses on startup (only if AI enabled)
  if (AI_ENABLED) {
    console.log("[Main] [AI] AI processing is ENABLED - running backfill");
    await backfillMissingAI();
  } else {
    console.log("[Main] [AI] AI processing is DISABLED - skipping backfill (set AI_ENABLED=true to enable)");
  }

  console.log("[Main] All workers running\n");
}

/**
 * Graceful shutdown handler
 */
async function shutdown(signal: string) {
  console.log(`\n[Main] Received ${signal}, shutting down gracefully...`);

  // Close all workers
  for (const worker of workers) {
    await worker.close();
  }

  console.log("[Main] All workers stopped");
  process.exit(0);
}

// Handle shutdown signals
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  console.error("[Main] Uncaught exception:", error);
  shutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  console.error("[Main] Unhandled rejection:", reason);
  shutdown("unhandledRejection");
});

// Start the workers
startWorkers().catch((error) => {
  console.error("[Main] Failed to start workers:", error);
  process.exit(1);
});
