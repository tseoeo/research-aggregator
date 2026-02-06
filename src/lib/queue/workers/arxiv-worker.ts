/**
 * arXiv Fetch Worker
 *
 * Fetches papers from arXiv using per-category fetching with pagination.
 *
 * ARCHITECTURE:
 * - Fetches each AI category SEPARATELY (more reliable than OR queries)
 * - Uses pagination to get ALL papers (not just first 100)
 * - Deduplicates across categories (same paper can appear in cs.AI and cs.LG)
 * - Only handles paper ingestion (AI processing is triggered separately)
 * - Social monitoring is auto-queued (not AI, just social media checks)
 */

import { Worker, Job } from "bullmq";
import { redisConnection, getRedisClient } from "../../redis";
import { arxivService, AI_CATEGORIES, type ArxivPaper } from "../../services/arxiv";
import { db } from "../../db";
import { papers, paperSources, ingestionRuns } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { socialMonitorQueue, summaryQueue, analysisQueue } from "../queues";

import { getAiEnabledRuntime } from "../../ai/runtime-toggle";

interface ArxivFetchJob {
  category?: string;
  categories?: readonly string[];
  maxResults?: number;
  useAllAICategories?: boolean;
  maxPagesPerCategory?: number; // Limit pagination depth
}

interface ArxivFetchByDateJob {
  date: string; // ISO date string "2026-02-04"
  categories?: string[]; // Categories to fetch (defaults to AI_CATEGORIES)
}

interface FetchStats {
  category: string;
  fetched: number;
  pages: number;
}

interface FetchResult {
  totalFetched: number;
  uniquePapers: number;
  newPapers: number;
  duplicatesSkipped: number;
  existingSkipped: number;
  byCategory: FetchStats[];
  socialMonitorQueued: number;
  summaryJobsQueued: number;
  analysisJobsQueued: number;
}

interface DateFetchResult extends FetchResult {
  date: string;
  expectedTotal: number;
  complete: boolean;
}

/**
 * Ensure arXiv source exists in database
 */
async function ensureArxivSource(): Promise<number> {
  const existing = await db
    .select({ id: paperSources.id })
    .from(paperSources)
    .where(eq(paperSources.name, "arxiv"))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  const result = await db
    .insert(paperSources)
    .values({
      name: "arxiv",
      baseUrl: "https://arxiv.org",
      isActive: true,
    })
    .returning({ id: paperSources.id });

  return result[0].id;
}

/**
 * Fetch all papers from a single category with pagination
 */
async function fetchCategoryWithPagination(
  category: string,
  maxPages: number = 5,
  perPage: number = 100
): Promise<{ papers: ArxivPaper[]; stats: FetchStats }> {
  const allPapers: ArxivPaper[] = [];
  let page = 0;
  let hasMore = true;

  console.log(`[ArxivWorker] Fetching category ${category} with pagination...`);

  while (hasMore && page < maxPages) {
    try {
      const result = await arxivService.fetchPapersPaginated(category, page, perPage);
      allPapers.push(...result.papers);
      hasMore = result.hasMore;
      page++;

      console.log(`[ArxivWorker] ${category} page ${page}: ${result.papers.length} papers (hasMore: ${hasMore})`);

      // If we got fewer papers than requested, we've reached the end
      if (result.papers.length < perPage) {
        hasMore = false;
      }
    } catch (error) {
      console.error(`[ArxivWorker] Error fetching ${category} page ${page}:`, error);
      // Continue with what we have rather than failing completely
      break;
    }
  }

  return {
    papers: allPapers,
    stats: {
      category,
      fetched: allPapers.length,
      pages: page,
    },
  };
}

/**
 * Process arXiv fetch job - fetches each category separately with pagination
 */
async function processArxivFetch(job: Job<ArxivFetchJob>): Promise<FetchResult> {
  const {
    category,
    useAllAICategories = true,
    maxPagesPerCategory = 3, // Default: 3 pages per category (300 papers max per category)
  } = job.data;

  const categoriesToFetch = useAllAICategories
    ? [...AI_CATEGORIES]
    : category
    ? [category]
    : ["cs.AI"];

  console.log(`[ArxivWorker] Starting fetch for categories: ${categoriesToFetch.join(", ")}`);
  console.log(`[ArxivWorker] Max pages per category: ${maxPagesPerCategory}`);
  const aiEnabled = await getAiEnabledRuntime();
  console.log(`[ArxivWorker] AI processing: ${aiEnabled ? "ENABLED" : "DISABLED"}`);


  // Track unique papers across categories (same paper can be in cs.AI and cs.LG)
  const seenArxivIds = new Set<string>();
  const uniquePapers: ArxivPaper[] = [];
  const categoryStats: FetchStats[] = [];
  let totalFetched = 0;
  let duplicatesSkipped = 0;

  // Fetch each category separately
  for (const cat of categoriesToFetch) {
    const { papers: categoryPapers, stats } = await fetchCategoryWithPagination(
      cat,
      maxPagesPerCategory
    );

    categoryStats.push(stats);
    totalFetched += categoryPapers.length;

    // Deduplicate across categories
    for (const paper of categoryPapers) {
      if (!seenArxivIds.has(paper.arxivId)) {
        seenArxivIds.add(paper.arxivId);
        uniquePapers.push(paper);
      } else {
        duplicatesSkipped++;
      }
    }
  }

  console.log(`[ArxivWorker] Total fetched: ${totalFetched}, Unique: ${uniquePapers.length}, Cross-category duplicates: ${duplicatesSkipped}`);

  // Insert papers into database
  const sourceId = await ensureArxivSource();
  let newCount = 0;
  let existingSkipped = 0;
  let socialMonitorQueued = 0;
  let summaryJobsQueued = 0;
  let analysisJobsQueued = 0;

  for (const paper of uniquePapers) {
    // Use onConflictDoNothing to handle race conditions - if another worker
    // inserted the same paper between our dedup check and insert, we skip it
    const result = await db
      .insert(papers)
      .values({
        sourceId,
        externalId: paper.arxivId,
        title: paper.title,
        abstract: paper.abstract,
        publishedAt: paper.publishedAt,
        updatedAt: paper.updatedAt,
        pdfUrl: paper.pdfUrl,
        categories: paper.categories,
        primaryCategory: paper.primaryCategory,
      })
      .onConflictDoNothing({
        target: [papers.sourceId, papers.externalId],
      })
      .returning({ id: papers.id });

    // If no row returned, paper already existed - skip
    if (result.length === 0) {
      existingSkipped++;
      continue;
    }

    const paperId = result[0].id;
    newCount++;

    // Queue for social monitoring (staggered to respect rate limits)
    await socialMonitorQueue.add(
      "monitor-paper",
      {
        paperId,
        arxivId: paper.arxivId,
        title: paper.title,
      },
      { delay: 1000 * newCount }
    );
    socialMonitorQueued++;

    // Queue for AI processing only if enabled (runtime check)
    if (aiEnabled) {
      // Queue for summary generation (staggered - 2s between jobs)
      await summaryQueue.add(
        "generate-summary",
        {
          paperId,
          arxivId: paper.arxivId,
          title: paper.title,
          abstract: paper.abstract,
        },
        { delay: 2000 * newCount }
      );
      summaryJobsQueued++;
      console.log(`[ArxivWorker] [AI] Queued summary job for paper ${paperId}`);

      // Queue for DTL-P analysis (staggered - 12s between jobs, analysis is expensive)
      await analysisQueue.add(
        "analyze-paper",
        {
          paperId,
          title: paper.title,
          abstract: paper.abstract,
          year: paper.publishedAt?.getFullYear(),
        },
        { delay: 12000 * newCount }
      );
      analysisJobsQueued++;
      console.log(`[ArxivWorker] [AI] Queued analysis job for paper ${paperId}`);
    }
  }

  const resultSummary: FetchResult = {
    totalFetched,
    uniquePapers: uniquePapers.length,
    newPapers: newCount,
    duplicatesSkipped,
    existingSkipped,
    byCategory: categoryStats,
    socialMonitorQueued,
    summaryJobsQueued,
    analysisJobsQueued,
  };

  console.log(`[ArxivWorker] Complete:`, JSON.stringify(resultSummary, null, 2));

  return resultSummary;
}

/**
 * Process arXiv fetch by date job (Phase 1)
 * Fetches ALL papers for a specific date across all AI categories.
 * Uses date-based filtering to ensure 100% capture.
 */
async function processArxivFetchByDate(job: Job<ArxivFetchByDateJob>): Promise<DateFetchResult> {
  const { date: dateStr, categories = [...AI_CATEGORIES] } = job.data;
  const date = new Date(dateStr);

  console.log(`[ArxivWorker] Starting date-based fetch for ${dateStr}`);
  console.log(`[ArxivWorker] Categories: ${categories.join(", ")}`);
  const aiEnabled = await getAiEnabledRuntime();
  console.log(`[ArxivWorker] AI processing: ${aiEnabled ? "ENABLED" : "DISABLED"}`);

  // Phase E: Acquire Redis lock for multi-replica safety
  const lockKey = `arxiv:fetch-lock:${dateStr}`;
  const { acquireLock, releaseLock } = await import("../../redis");
  const lockAcquired = await acquireLock(lockKey, 600); // 10 minute TTL

  if (!lockAcquired) {
    console.log(`[ArxivWorker] Lock not acquired for ${dateStr}, another worker is processing. Skipping.`);
    return {
      date: dateStr,
      expectedTotal: 0,
      complete: true,
      totalFetched: 0,
      uniquePapers: 0,
      newPapers: 0,
      duplicatesSkipped: 0,
      existingSkipped: 0,
      byCategory: [],
      socialMonitorQueued: 0,
      summaryJobsQueued: 0,
      analysisJobsQueued: 0,
    };
  }

  try {
    // Track unique papers across categories
    const seenArxivIds = new Set<string>();
    const uniquePapers: ArxivPaper[] = [];
    const categoryStats: FetchStats[] = [];
    let totalFetched = 0;
    let duplicatesSkipped = 0;
    let expectedTotal = 0;
    let allComplete = true;

    // Fetch each category for this date
    for (const category of categories) {
      // Phase A: Create/update ingestion run record
      const runDate = new Date(dateStr);
      runDate.setUTCHours(0, 0, 0, 0);

      try {
        // Try to insert a new ingestion run (will fail if exists due to unique constraint)
        await db
          .insert(ingestionRuns)
          .values({
            date: runDate,
            category,
            status: "started",
            expectedTotal: null,
            fetchedTotal: 0,
            lastStartIndex: 0,
          })
          .onConflictDoNothing();
      } catch {
        // Ignore - row may already exist
      }

      // Update status to started
      await db
        .update(ingestionRuns)
        .set({ status: "started", startedAt: new Date() })
        .where(and(eq(ingestionRuns.date, runDate), eq(ingestionRuns.category, category)));

      try {
        const result = await arxivService.fetchAllPapersForDate(date, category);

        categoryStats.push({
          category,
          fetched: result.papers.length,
          pages: Math.ceil(result.papers.length / 100),
        });

        totalFetched += result.papers.length;
        expectedTotal += result.total;

        if (!result.complete) {
          allComplete = false;
        }

        // Deduplicate across categories
        for (const paper of result.papers) {
          if (!seenArxivIds.has(paper.arxivId)) {
            seenArxivIds.add(paper.arxivId);
            uniquePapers.push(paper);
          } else {
            duplicatesSkipped++;
          }
        }

        // Phase A: Update ingestion run with results
        await db
          .update(ingestionRuns)
          .set({
            expectedTotal: result.total,
            fetchedTotal: result.papers.length,
            status: result.complete ? "completed" : "partial",
            completedAt: new Date(),
            lastStartIndex: result.papers.length,
          })
          .where(and(eq(ingestionRuns.date, runDate), eq(ingestionRuns.category, category)));

      } catch (error) {
        console.error(`[ArxivWorker] Error fetching ${category} for ${dateStr}:`, error);
        allComplete = false;

        // Phase A: Mark as failed
        await db
          .update(ingestionRuns)
          .set({
            status: "failed",
            errorMessage: error instanceof Error ? error.message : "Unknown error",
            completedAt: new Date(),
          })
          .where(and(eq(ingestionRuns.date, runDate), eq(ingestionRuns.category, category)));
      }
    }

    console.log(
      `[ArxivWorker] Date ${dateStr}: Total fetched: ${totalFetched}, ` +
      `Expected: ${expectedTotal}, Unique: ${uniquePapers.length}, ` +
      `Duplicates: ${duplicatesSkipped}, Complete: ${allComplete}`
    );

    // Insert papers into database
    const sourceId = await ensureArxivSource();
    let newCount = 0;
    let existingSkipped = 0;
    let socialMonitorQueued = 0;
    let summaryJobsQueued = 0;
    let analysisJobsQueued = 0;

    for (const paper of uniquePapers) {
      const result = await db
        .insert(papers)
        .values({
          sourceId,
          externalId: paper.arxivId,
          title: paper.title,
          abstract: paper.abstract,
          publishedAt: paper.publishedAt,
          updatedAt: paper.updatedAt,
          pdfUrl: paper.pdfUrl,
          categories: paper.categories,
          primaryCategory: paper.primaryCategory,
        })
        .onConflictDoNothing({
          target: [papers.sourceId, papers.externalId],
        })
        .returning({ id: papers.id });

      if (result.length === 0) {
        existingSkipped++;
        continue;
      }

      const paperId = result[0].id;
      newCount++;

      // Queue for social monitoring
      await socialMonitorQueue.add(
        "monitor-paper",
        {
          paperId,
          arxivId: paper.arxivId,
          title: paper.title,
        },
        { delay: 1000 * newCount }
      );
      socialMonitorQueued++;

      // Queue for AI processing only if enabled
      if (aiEnabled) {
        await summaryQueue.add(
          "generate-summary",
          {
            paperId,
            arxivId: paper.arxivId,
            title: paper.title,
            abstract: paper.abstract,
          },
          { delay: 2000 * newCount }
        );
        summaryJobsQueued++;

        await analysisQueue.add(
          "analyze-paper",
          {
            paperId,
            title: paper.title,
            abstract: paper.abstract,
            year: paper.publishedAt?.getFullYear(),
          },
          { delay: 12000 * newCount }
        );
        analysisJobsQueued++;
      }
    }

    const resultSummary: DateFetchResult = {
      date: dateStr,
      expectedTotal,
      complete: allComplete,
      totalFetched,
      uniquePapers: uniquePapers.length,
      newPapers: newCount,
      duplicatesSkipped,
      existingSkipped,
      byCategory: categoryStats,
      socialMonitorQueued,
      summaryJobsQueued,
      analysisJobsQueued,
    };

    console.log(`[ArxivWorker] Date fetch complete:`, JSON.stringify(resultSummary, null, 2));

    return resultSummary;
  } finally {
    // Always release the lock
    await releaseLock(lockKey);
  }
}

export function createArxivWorker() {
  // Main worker handles both job types
  const worker = new Worker(
    "arxiv-fetch",
    async (job: Job) => {
      // Route to appropriate handler based on job name
      if (job.name.startsWith("fetch-by-date")) {
        return processArxivFetchByDate(job as Job<ArxivFetchByDateJob>);
      }
      return processArxivFetch(job as Job<ArxivFetchJob>);
    },
    {
      connection: redisConnection,
      concurrency: 1, // One at a time to respect rate limits
    }
  );

  worker.on("completed", (job, result) => {
    console.log(
      `[ArxivWorker] Job ${job.id} completed: ` +
      `${result.newPapers} new papers from ${result.uniquePapers} unique (${result.totalFetched} total fetched), ` +
      `queued: ${result.summaryJobsQueued} summaries, ${result.analysisJobsQueued} analyses`
    );
  });

  worker.on("failed", (job, err) => {
    console.error(`[ArxivWorker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
