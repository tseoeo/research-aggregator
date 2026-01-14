/**
 * arXiv Fetch Worker
 *
 * Periodically fetches new papers from arXiv and queues them for processing.
 */

import { Worker, Job } from "bullmq";
import { redisConnection } from "../../redis";
import { arxivService, AI_CATEGORIES } from "../../services/arxiv";
import { db } from "../../db";
import { papers, paperSources } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { summaryQueue, socialMonitorQueue } from "../queues";

interface ArxivFetchJob {
  category?: string;
  categories?: readonly string[];
  maxResults?: number;
  useAllAICategories?: boolean;
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

async function processArxivFetch(job: Job<ArxivFetchJob>) {
  const { category, useAllAICategories = true, maxResults = 100 } = job.data;

  let fetchedPapers;
  if (useAllAICategories) {
    console.log(`[ArxivWorker] Fetching papers from all AI categories: ${AI_CATEGORIES.join(", ")}`);
    fetchedPapers = await arxivService.fetchAIPapers(maxResults);
  } else {
    console.log(`[ArxivWorker] Fetching papers for category: ${category}`);
    fetchedPapers = await arxivService.fetchRecentPapers(category || "cs.AI", maxResults);
  }

  console.log(`[ArxivWorker] Found ${fetchedPapers.length} papers`);

  const sourceId = await ensureArxivSource();
  let newCount = 0;

  for (const paper of fetchedPapers) {
    // Check if paper already exists
    const existing = await db
      .select({ id: papers.id })
      .from(papers)
      .where(
        and(eq(papers.sourceId, sourceId), eq(papers.externalId, paper.arxivId))
      )
      .limit(1);

    if (existing.length > 0) {
      continue; // Skip existing paper
    }

    // Insert new paper
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
      .returning({ id: papers.id });

    newCount++;

    // Queue for summary generation
    await summaryQueue.add(
      "generate-summary",
      {
        paperId: result[0].id,
        arxivId: paper.arxivId,
        title: paper.title,
        abstract: paper.abstract,
      },
      { delay: 1000 * newCount } // Stagger to avoid rate limits
    );

    // Queue for social monitoring
    await socialMonitorQueue.add(
      "monitor-paper",
      {
        paperId: result[0].id,
        arxivId: paper.arxivId,
        title: paper.title,
      },
      { delay: 2000 * newCount }
    );
  }

  console.log(`[ArxivWorker] Added ${newCount} new papers`);

  return { fetched: fetchedPapers.length, new: newCount };
}

export function createArxivWorker() {
  return new Worker("arxiv-fetch", processArxivFetch, {
    connection: redisConnection,
    concurrency: 1, // One at a time to respect rate limits
  });
}
