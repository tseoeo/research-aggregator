/**
 * arXiv Backfill Worker
 *
 * Fetches historical papers from arXiv for a specific date range.
 * Used to fill gaps in paper collection or backfill from before the aggregator started.
 *
 * ARCHITECTURE:
 * - Processes one date at a time (to avoid overwhelming arXiv API)
 * - Fetches all AI categories for the given date
 * - Deduplicates across categories
 * - Inserts new papers (skips existing)
 * - Does NOT queue AI processing (manual trigger after backfill)
 */

import { Worker, Job } from "bullmq";
import { redisConnection } from "../../redis";
import { arxivService, AI_CATEGORIES, type ArxivPaper } from "../../services/arxiv";
import { db } from "../../db";
import { papers, paperSources } from "../../db/schema";
import { eq, and } from "drizzle-orm";

interface BackfillJob {
  date: string; // ISO date string: "2024-01-15"
  categories?: string[];
  maxResultsPerCategory?: number;
}

interface BackfillResult {
  date: string;
  totalFetched: number;
  uniquePapers: number;
  newPapers: number;
  duplicatesSkipped: number;
  existingSkipped: number;
  byCategory: { category: string; fetched: number }[];
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
 * Process backfill job for a single date
 */
async function processBackfillJob(job: Job<BackfillJob>): Promise<BackfillResult> {
  const {
    date,
    categories = [...AI_CATEGORIES],
    maxResultsPerCategory = 200,
  } = job.data;

  const targetDate = new Date(date);
  console.log(`[BackfillWorker] Starting backfill for ${date}, categories: ${categories.join(", ")}`);

  // Track unique papers across categories
  const seenArxivIds = new Set<string>();
  const uniquePapers: ArxivPaper[] = [];
  const categoryStats: { category: string; fetched: number }[] = [];
  let totalFetched = 0;
  let duplicatesSkipped = 0;

  // Fetch each category for this date
  for (const category of categories) {
    try {
      const { papers: categoryPapers, total } = await arxivService.fetchByDateRange(
        targetDate,
        targetDate,
        category,
        { maxResults: maxResultsPerCategory }
      );

      console.log(`[BackfillWorker] ${category} on ${date}: ${categoryPapers.length} papers (total available: ${total})`);

      categoryStats.push({ category, fetched: categoryPapers.length });
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
    } catch (error) {
      console.error(`[BackfillWorker] Error fetching ${category} for ${date}:`, error);
      categoryStats.push({ category, fetched: 0 });
    }
  }

  console.log(`[BackfillWorker] ${date}: Total fetched: ${totalFetched}, Unique: ${uniquePapers.length}`);

  // Insert papers into database
  const sourceId = await ensureArxivSource();
  let newCount = 0;
  let existingSkipped = 0;

  for (const paper of uniquePapers) {
    // Check if paper already exists
    const existing = await db
      .select({ id: papers.id })
      .from(papers)
      .where(
        and(eq(papers.sourceId, sourceId), eq(papers.externalId, paper.arxivId))
      )
      .limit(1);

    if (existing.length > 0) {
      existingSkipped++;
      continue;
    }

    // Insert new paper
    await db.insert(papers).values({
      sourceId,
      externalId: paper.arxivId,
      title: paper.title,
      abstract: paper.abstract,
      publishedAt: paper.publishedAt,
      updatedAt: paper.updatedAt,
      pdfUrl: paper.pdfUrl,
      categories: paper.categories,
      primaryCategory: paper.primaryCategory,
    });

    newCount++;
  }

  const result: BackfillResult = {
    date,
    totalFetched,
    uniquePapers: uniquePapers.length,
    newPapers: newCount,
    duplicatesSkipped,
    existingSkipped,
    byCategory: categoryStats,
  };

  console.log(`[BackfillWorker] ${date} complete:`, JSON.stringify(result, null, 2));

  return result;
}

export function createBackfillWorker() {
  const worker = new Worker("arxiv-backfill", processBackfillJob, {
    connection: redisConnection,
    concurrency: 1, // One at a time to respect rate limits
  });

  worker.on("completed", (job, result) => {
    console.log(
      `[BackfillWorker] Job ${job.id} completed: ` +
      `${result.newPapers} new papers for ${result.date}`
    );
  });

  worker.on("failed", (job, err) => {
    console.error(`[BackfillWorker] Job ${job?.id} failed:`, err.message);
  });

  return worker;
}
