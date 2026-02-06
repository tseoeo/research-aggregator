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
  createAnalysisV3Worker,
  createBackfillWorker,
} from "../lib/queue/workers";
import { arxivFetchQueue, socialMonitorQueue, newsFetchQueue, summaryQueue, analysisQueue, analysisV3Queue } from "../lib/queue/queues";
import { db } from "../lib/db";
import { papers, paperCardAnalyses } from "../lib/db/schema";
import { desc, gte, isNull, eq, sql, lte, and } from "drizzle-orm";
import { AI_CATEGORIES } from "../lib/services/arxiv";
import { getAiEnabledRuntime, setAiEnabledRuntime, subscribeToConfigUpdates } from "../lib/ai/runtime-toggle";

// Track all workers for graceful shutdown
const workers: Worker[] = [];

// Old AI workers are tracked separately for dynamic pause/resume
// Note: v3 analysis worker is NOT included here — it has its own control plane
let summaryWorker: Worker | null = null;
let analysisWorker: Worker | null = null;

/**
 * Get yesterday's date as ISO string (YYYY-MM-DD)
 */
function getYesterdayISO(): string {
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return yesterday.toISOString().split("T")[0];
}

/**
 * Get date N days ago as ISO string (YYYY-MM-DD)
 */
function getDaysAgoISO(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().split("T")[0];
}

/**
 * Generate deterministic job ID for date-based fetch (Phase F)
 * Format: arxiv-fetch-date:YYYY-MM-DD
 */
function getDateFetchJobId(date: string): string {
  // BullMQ doesn't allow colons in job IDs
  return `arxiv-fetch-date-${date}`;
}

/**
 * Schedule recurring arXiv fetch jobs
 *
 * Note: arXiv publishes new papers around 21:00 UTC on weekdays.
 * We schedule the fetch for 22:00 UTC to allow time for processing.
 *
 * Phase 1: Uses date-based fetching for guaranteed 100% capture
 * Phase B: Adds overlap window (fetches yesterday AND day-before-yesterday)
 * Phase F: Uses deterministic job IDs to prevent duplicates
 */
async function scheduleJobs() {
  // Schedule arXiv fetch daily at 22:00 UTC (1 hour after arXiv publishes)
  const existingJobs = await arxivFetchQueue.getRepeatableJobs();

  // Remove any existing repeatable jobs first
  for (const job of existingJobs) {
    await arxivFetchQueue.removeRepeatableByKey(job.key);
  }

  // Phase 1: Schedule date-based fetch for yesterday at 22:00 UTC
  await arxivFetchQueue.add(
    "fetch-by-date-daily",
    {
      // Will be replaced with actual date when job runs - use placeholder
      // The job handler reads the date dynamically
    },
    {
      repeat: {
        pattern: "0 22 * * *", // Daily at 22:00 UTC
      },
      jobId: "arxiv-fetch-date-daily", // Idempotent ID for the repeatable job
    }
  );

  console.log("[Scheduler] Scheduled date-based arXiv fetch (daily at 22:00 UTC)");

  // On startup, queue date-based fetch for yesterday and day-before-yesterday (Phase B: Overlap Window)
  const yesterday = getYesterdayISO();
  const dayBeforeYesterday = getDaysAgoISO(2);

  // Phase F: Use deterministic job IDs to prevent duplicates
  const yesterdayJobId = getDateFetchJobId(yesterday);
  const dayBeforeJobId = getDateFetchJobId(dayBeforeYesterday);

  // Queue yesterday's fetch
  await arxivFetchQueue.add(
    "fetch-by-date",
    {
      date: yesterday,
      categories: [...AI_CATEGORIES],
    },
    {
      delay: 5000, // Wait 5 seconds for workers to be ready
      jobId: yesterdayJobId,
    }
  );
  console.log(`[Scheduler] Queued date-based fetch for yesterday (${yesterday})`);

  // Queue day-before-yesterday's fetch (Phase B: Overlap Window for late arrivals)
  await arxivFetchQueue.add(
    "fetch-by-date",
    {
      date: dayBeforeYesterday,
      categories: [...AI_CATEGORIES],
    },
    {
      delay: 10000, // Stagger after yesterday's job
      jobId: dayBeforeJobId,
    }
  );
  console.log(`[Scheduler] Queued date-based fetch for day-before-yesterday (${dayBeforeYesterday}) [Overlap Window]`);

  // Schedule daily refresh for social mentions and news
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
 * Detect gaps in paper ingestion (Phase 2)
 * Uses publishedAt for gap detection (Phase C fix - not createdAt)
 *
 * @param days - Number of days to check for gaps
 * @param minPapersPerDay - Minimum expected papers per day (days below this are gaps)
 * @returns Array of ISO date strings with missing/low data
 */
async function detectGaps(days: number = 30, minPapersPerDay: number = 50): Promise<string[]> {
  console.log(`[GapDetection] Checking for gaps in the last ${days} days (min ${minPapersPerDay} papers/day)...`);

  try {
    const cutoffDate = new Date();
    cutoffDate.setUTCDate(cutoffDate.getUTCDate() - days);
    cutoffDate.setUTCHours(0, 0, 0, 0);

    const yesterday = new Date();
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    yesterday.setUTCHours(23, 59, 59, 999);

    // Get paper counts by publishedAt date (Phase C: use publishedAt, not createdAt)
    const paperCounts = await db
      .select({
        date: sql<string>`DATE(published_at)::text`,
        count: sql<number>`count(*)::int`,
      })
      .from(papers)
      .where(
        and(
          gte(papers.publishedAt, cutoffDate),
          lte(papers.publishedAt, yesterday)
        )
      )
      .groupBy(sql`DATE(published_at)`)
      .orderBy(sql`DATE(published_at)`);

    // Build a map of dates with counts
    const countsByDate = new Map<string, number>();
    for (const row of paperCounts) {
      if (row.date) {
        countsByDate.set(row.date, row.count);
      }
    }

    // Generate all dates in the range and find gaps
    const missingDates: string[] = [];
    const current = new Date(cutoffDate);

    while (current <= yesterday) {
      const dateStr = current.toISOString().split("T")[0];
      const count = countsByDate.get(dateStr) || 0;

      // Skip weekends (arXiv doesn't publish on weekends)
      const dayOfWeek = current.getUTCDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

      if (!isWeekend && count < minPapersPerDay) {
        console.log(`[GapDetection] Gap found: ${dateStr} has only ${count} papers (expected >= ${minPapersPerDay})`);
        missingDates.push(dateStr);
      }

      current.setUTCDate(current.getUTCDate() + 1);
    }

    console.log(`[GapDetection] Found ${missingDates.length} days with gaps`);
    return missingDates;
  } catch (error) {
    console.error("[GapDetection] Error:", error);
    return [];
  }
}

/**
 * Backfill missing dates detected by gap detection (Phase 2)
 * Queues date-based fetch jobs with staggered delays
 */
async function backfillMissingDates() {
  const missingDates = await detectGaps(30, 50);

  if (missingDates.length === 0) {
    console.log("[GapBackfill] No gaps detected in the last 30 days");
    return;
  }

  console.log(`[GapBackfill] Queuing backfill for ${missingDates.length} dates...`);

  for (let i = 0; i < missingDates.length; i++) {
    const date = missingDates[i];
    const jobId = getDateFetchJobId(date);

    await arxivFetchQueue.add(
      "fetch-by-date",
      {
        date,
        categories: [...AI_CATEGORIES],
      },
      {
        delay: (i + 1) * 60000, // 1 minute between dates to avoid rate limiting
        jobId, // Phase F: Idempotent job ID
      }
    );

    console.log(`[GapBackfill] Queued fetch for ${date} (delay: ${i + 1} minutes)`);
  }

  console.log(`[GapBackfill] Queued ${missingDates.length} backfill jobs`);
}

/**
 * Set AI workers and queues to paused or resumed state
 */
async function setAiWorkersState(enabled: boolean) {
  // Note: Only controls old summary + DTL-P workers.
  // V3 analysis has its own independent control plane (auto_enabled + budget).
  if (enabled) {
    console.log("[Main] [AI] Resuming old AI workers and queues...");
    if (summaryWorker) await summaryWorker.resume();
    if (analysisWorker) await analysisWorker.resume();
    await summaryQueue.resume();
    await analysisQueue.resume();
    console.log("[Main] [AI] Old AI workers and queues RESUMED");
  } else {
    console.log("[Main] [AI] Pausing old AI workers and queues...");
    if (summaryWorker) await summaryWorker.pause();
    if (analysisWorker) await analysisWorker.pause();
    await summaryQueue.pause();
    await analysisQueue.pause();
    console.log("[Main] [AI] Old AI workers and queues PAUSED");
  }
}

/**
 * Start all workers
 */
async function startWorkers() {
  console.log("=".repeat(50));
  console.log("Starting Research Aggregator Workers");
  console.log("=".repeat(50));

  // Create and start non-AI workers (always active)
  workers.push(createArxivWorker());
  workers.push(createSocialMonitorWorker());
  workers.push(createNewsWorker());
  workers.push(createBackfillWorker());

  // Always create old AI workers — control via pause/resume (gated by AI_ENABLED toggle)
  summaryWorker = createSummaryWorker();
  analysisWorker = createAnalysisWorker();
  workers.push(summaryWorker);
  workers.push(analysisWorker);

  // V3 analysis worker — always active, independent of old AI toggle.
  // Controlled by its own auto_enabled + budget system.
  const v3Worker = createAnalysisV3Worker();
  workers.push(v3Worker);

  // Ensure the v3 queue is never paused (clears any stale pause state from Redis)
  await analysisV3Queue.resume();
  console.log("[Main] [V3] Analysis v3 queue resumed (always active)");

  // Check runtime toggle to decide initial AI state
  // If env var explicitly says false, force Redis to match (env override for emergency stop)
  if (process.env.AI_ENABLED === "false") {
    const redisState = await getAiEnabledRuntime(true);
    if (redisState) {
      console.log("[Main] [AI] AI_ENABLED=false env override — forcing Redis toggle off");
      await setAiEnabledRuntime(false);
    }
  }
  const aiEnabled = await getAiEnabledRuntime(true); // skip cache for fresh read
  console.log(`[Main] [AI] Runtime AI toggle: ${aiEnabled ? "ENABLED" : "DISABLED"}`);

  if (!aiEnabled) {
    // Pause AI workers and queues immediately
    await setAiWorkersState(false);
  } else {
    console.log("[Main] [AI] AI workers running (summary + analysis)");
  }

  console.log(`\n[Main] Started ${workers.length} workers (AI: ${aiEnabled ? "ON (active)" : "ON (paused)"})`);

  // Subscribe to config updates via Redis Pub/Sub for dynamic toggle
  subscribeToConfigUpdates(async (data) => {
    if (data.key === "ai_enabled") {
      const enabled = data.value === true;
      console.log(`[Main] [AI] Config update received: ai_enabled=${enabled}`);
      await setAiWorkersState(enabled);
    }
  });
  console.log("[Main] [AI] Subscribed to config:updates Pub/Sub channel");

  // Schedule recurring jobs
  await scheduleJobs();

  // Phase 2: Detect and backfill gaps on startup
  console.log("[Main] Running gap detection and backfill...");
  await backfillMissingDates();

  // Backfill missing summaries and analyses on startup (only if AI enabled)
  if (aiEnabled) {
    console.log("[Main] [AI] AI processing is ENABLED - running backfill");
    await backfillMissingAI();
  } else {
    console.log("[Main] [AI] AI processing is DISABLED - skipping backfill (toggle on from admin panel to enable)");
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
