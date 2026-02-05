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
import { redisConnection } from "../../redis";
import { arxivService, AI_CATEGORIES, type ArxivPaper } from "../../services/arxiv";
import { db } from "../../db";
import { papers, paperSources } from "../../db/schema";
import { eq } from "drizzle-orm";
import { socialMonitorQueue, summaryQueue, analysisQueue } from "../queues";

// AI processing toggle - set AI_ENABLED=true to enable AI summaries and analyses
const AI_ENABLED = process.env.AI_ENABLED === "true";

interface ArxivFetchJob {
  category?: string;
  categories?: readonly string[];
  maxResults?: number;
  useAllAICategories?: boolean;
  maxPagesPerCategory?: number; // Limit pagination depth
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
  console.log(`[ArxivWorker] AI processing: ${AI_ENABLED ? "ENABLED" : "DISABLED (set AI_ENABLED=true to enable)"}`);


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

    // Queue for AI processing only if enabled
    if (AI_ENABLED) {
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

export function createArxivWorker() {
  const worker = new Worker("arxiv-fetch", processArxivFetch, {
    connection: redisConnection,
    concurrency: 1, // One at a time to respect rate limits
  });

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
