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
} from "../lib/queue/workers";
import { arxivFetchQueue, socialMonitorQueue, newsFetchQueue } from "../lib/queue/queues";
import { db } from "../lib/db";
import { papers } from "../lib/db/schema";
import { desc, gte } from "drizzle-orm";

// Track all workers for graceful shutdown
const workers: Worker[] = [];

/**
 * Schedule recurring arXiv fetch jobs
 */
async function scheduleJobs() {
  // Schedule arXiv fetch every 6 hours for cs.AI category
  const existingJobs = await arxivFetchQueue.getRepeatableJobs();

  // Remove any existing repeatable jobs first
  for (const job of existingJobs) {
    await arxivFetchQueue.removeRepeatableByKey(job.key);
  }

  // Add new repeatable job - fetch from ALL AI categories
  await arxivFetchQueue.add(
    "fetch-all-ai",
    {
      useAllAICategories: true,
      maxResults: 100, // Larger batch to catch all new papers
    },
    {
      repeat: {
        pattern: "0 */6 * * *", // Every 6 hours
      },
    }
  );

  console.log("[Scheduler] Scheduled arXiv fetch job for all AI categories (every 6 hours)");

  // Also run immediately on startup
  await arxivFetchQueue.add(
    "fetch-all-ai-startup",
    {
      useAllAICategories: true,
      maxResults: 50, // Smaller batch for startup
    },
    {
      delay: 5000, // Wait 5 seconds for workers to be ready
    }
  );

  console.log("[Scheduler] Queued initial arXiv fetch for all AI categories");

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
 * Start all workers
 */
async function startWorkers() {
  console.log("=".repeat(50));
  console.log("Starting Research Aggregator Workers");
  console.log("=".repeat(50));

  // Create and start workers
  workers.push(createArxivWorker());
  workers.push(createSummaryWorker());
  workers.push(createSocialMonitorWorker());
  workers.push(createNewsWorker());
  workers.push(createAnalysisWorker());

  console.log(`\n[Main] Started ${workers.length} workers`);

  // Schedule recurring jobs
  await scheduleJobs();

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
