/**
 * arXiv Fetch Worker
 *
 * Periodically fetches new papers from arXiv.
 *
 * DECOUPLED ARCHITECTURE:
 * - This worker ONLY handles paper ingestion (insert into DB)
 * - AI processing (summaries, analysis) is triggered separately via admin endpoints
 * - Social monitoring is still auto-queued (not AI, just social media checks)
 *
 * This ensures papers are always ingested even if AI services are down or out of credits.
 */

import { Worker, Job } from "bullmq";
import { redisConnection } from "../../redis";
import { arxivService, AI_CATEGORIES } from "../../services/arxiv";
import { db } from "../../db";
import { papers, paperSources } from "../../db/schema";
import { eq, and } from "drizzle-orm";
import { socialMonitorQueue } from "../queues";

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

    // Queue for social monitoring (not AI - just checks social media mentions)
    await socialMonitorQueue.add(
      "monitor-paper",
      {
        paperId: result[0].id,
        arxivId: paper.arxivId,
        title: paper.title,
      },
      { delay: 1000 * newCount } // Stagger to respect rate limits
    );

    // NOTE: AI processing (summaries, analysis) is NOT auto-queued here.
    // Use admin endpoints to trigger AI processing:
    // - POST /api/admin/queue-summaries
    // - POST /api/admin/queue-analyses
    // - POST /api/admin/trigger-ai (both)
  }

  console.log(`[ArxivWorker] Added ${newCount} new papers (social monitoring queued, AI processing separate)`);

  return { fetched: fetchedPapers.length, new: newCount };
}

export function createArxivWorker() {
  return new Worker("arxiv-fetch", processArxivFetch, {
    connection: redisConnection,
    concurrency: 1, // One at a time to respect rate limits
  });
}
