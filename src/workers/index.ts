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
} from "../lib/queue/workers";
import { arxivFetchQueue } from "../lib/queue/queues";

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

  // Add new repeatable job
  await arxivFetchQueue.add(
    "fetch-cs-ai",
    {
      category: "cs.AI",
      maxResults: 50,
    },
    {
      repeat: {
        pattern: "0 */6 * * *", // Every 6 hours
      },
    }
  );

  console.log("[Scheduler] Scheduled arXiv fetch job (every 6 hours)");

  // Also run immediately on startup
  await arxivFetchQueue.add(
    "fetch-cs-ai-startup",
    {
      category: "cs.AI",
      maxResults: 25, // Smaller batch for startup
    },
    {
      delay: 5000, // Wait 5 seconds for workers to be ready
    }
  );

  console.log("[Scheduler] Queued initial arXiv fetch");
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
