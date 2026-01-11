/**
 * News Fetch Worker
 *
 * Fetches news articles about papers using Serper API.
 * Should be used sparingly to conserve API quota (2,500/month free).
 */

import { Worker, Job } from "bullmq";
import { redisConnection } from "../../redis";
import { serperService } from "../../services/serper";
import { db } from "../../db";
import { newsMentions } from "../../db/schema";
import { eq } from "drizzle-orm";

interface NewsFetchJob {
  paperId: string;
  arxivId: string;
  title: string;
  priority?: "high" | "normal"; // High priority for trending papers
}

/**
 * Check if a news article already exists by URL hash
 */
async function newsExists(urlHash: string): Promise<boolean> {
  const existing = await db
    .select({ id: newsMentions.id })
    .from(newsMentions)
    .where(eq(newsMentions.urlHash, urlHash))
    .limit(1);

  return existing.length > 0;
}

async function processNewsFetch(job: Job<NewsFetchJob>) {
  const { paperId, arxivId, title, priority = "normal" } = job.data;

  // Skip if Serper is not configured
  if (!serperService.isEnabled()) {
    console.log("[NewsWorker] Serper not configured, skipping");
    return { paperId, arxivId, newsCount: 0, skipped: true };
  }

  console.log(`[NewsWorker] Fetching news for: ${arxivId} (${priority})`);

  const articles = await serperService.searchForPaper(title, arxivId);

  let newCount = 0;

  for (const article of articles) {
    if (await newsExists(article.urlHash)) {
      continue;
    }

    try {
      await db.insert(newsMentions).values({
        paperId,
        title: article.title,
        snippet: article.snippet,
        url: article.url,
        sourceName: article.source,
        publishedAt: article.date ? new Date(article.date) : null,
        imageUrl: article.imageUrl,
        urlHash: article.urlHash,
      });

      newCount++;
    } catch (error) {
      // Unique constraint violation - article already exists
      console.debug(`[NewsWorker] Article already exists: ${article.url}`);
    }
  }

  console.log(`[NewsWorker] Added ${newCount} news articles for ${arxivId}`);

  return {
    paperId,
    arxivId,
    newsCount: newCount,
    totalFound: articles.length,
  };
}

export function createNewsWorker() {
  const worker = new Worker("news-fetch", processNewsFetch, {
    connection: redisConnection,
    concurrency: 1, // One at a time to conserve API quota
    limiter: {
      max: 5,
      duration: 60000, // Max 5 requests per minute
    },
  });

  worker.on("completed", (job, result) => {
    if (result.skipped) {
      console.log(`[NewsWorker] Job ${job.id} skipped (Serper not configured)`);
    } else {
      console.log(
        `[NewsWorker] Job ${job.id} completed: ${result.newsCount} new articles`
      );
    }
  });

  worker.on("failed", (job, err) => {
    console.error(`[NewsWorker] Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("[NewsWorker] Worker error:", err);
  });

  console.log("[NewsWorker] Started");

  return worker;
}
