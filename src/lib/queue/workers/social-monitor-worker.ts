/**
 * Social Monitor Worker
 *
 * Monitors Bluesky and Reddit for mentions of papers.
 */

import { Worker, Job } from "bullmq";
import { redisConnection } from "../../redis";
import { blueskyService } from "../../services/bluesky";
import { redditService } from "../../services/reddit";
import { db } from "../../db";
import { socialMentions, socialPlatforms } from "../../db/schema";
import { eq, and } from "drizzle-orm";

interface SocialMonitorJob {
  paperId: string;
  arxivId: string;
  title: string;
}

interface PlatformCache {
  bluesky?: number;
  reddit?: number;
}

let platformIds: PlatformCache = {};

/**
 * Ensure platform exists in database and return its ID
 */
async function ensurePlatform(name: string): Promise<number> {
  if (platformIds[name as keyof PlatformCache]) {
    return platformIds[name as keyof PlatformCache]!;
  }

  const existing = await db
    .select({ id: socialPlatforms.id })
    .from(socialPlatforms)
    .where(eq(socialPlatforms.name, name))
    .limit(1);

  if (existing.length > 0) {
    platformIds[name as keyof PlatformCache] = existing[0].id;
    return existing[0].id;
  }

  const result = await db
    .insert(socialPlatforms)
    .values({
      name,
      isActive: true,
      rateLimitPerHour: name === "bluesky" ? 100 : 60,
    })
    .returning({ id: socialPlatforms.id });

  platformIds[name as keyof PlatformCache] = result[0].id;
  return result[0].id;
}

/**
 * Check if a mention already exists
 */
async function mentionExists(
  platformId: number,
  externalId: string
): Promise<boolean> {
  const existing = await db
    .select({ id: socialMentions.id })
    .from(socialMentions)
    .where(
      and(
        eq(socialMentions.platformId, platformId),
        eq(socialMentions.externalId, externalId)
      )
    )
    .limit(1);

  return existing.length > 0;
}

async function processSocialMonitor(job: Job<SocialMonitorJob>) {
  const { paperId, arxivId, title } = job.data;

  console.log(`[SocialMonitor] Monitoring paper: ${arxivId}`);

  let blueskyCount = 0;
  let redditCount = 0;

  // Fetch Bluesky mentions
  try {
    const blueskyPosts = await blueskyService.searchForPaper(title, arxivId);
    const blueskyPlatformId = await ensurePlatform("bluesky");

    for (const post of blueskyPosts) {
      if (await mentionExists(blueskyPlatformId, post.uri)) {
        continue;
      }

      await db.insert(socialMentions).values({
        paperId,
        platformId: blueskyPlatformId,
        externalId: post.uri,
        authorHandle: post.authorHandle,
        authorName: post.authorName,
        authorProfileUrl: `https://bsky.app/profile/${post.authorHandle}`,
        content: post.content,
        url: post.url,
        likes: post.likes,
        reposts: post.reposts,
        replies: post.replies,
        postedAt: post.createdAt,
        contentHash: post.contentHash,
      });

      blueskyCount++;
    }

    console.log(`[SocialMonitor] Found ${blueskyCount} new Bluesky posts`);
  } catch (error) {
    console.error("[SocialMonitor] Bluesky error:", error);
  }

  // Fetch Reddit mentions
  try {
    const redditPosts = await redditService.searchForPaper(title, arxivId);
    const redditPlatformId = await ensurePlatform("reddit");

    for (const post of redditPosts) {
      if (await mentionExists(redditPlatformId, post.id)) {
        continue;
      }

      await db.insert(socialMentions).values({
        paperId,
        platformId: redditPlatformId,
        externalId: post.id,
        authorHandle: post.authorName,
        authorName: post.authorName,
        authorProfileUrl: `https://reddit.com/u/${post.authorName}`,
        content: post.content || post.title,
        url: post.permalink,
        likes: post.score,
        reposts: 0,
        replies: post.numComments,
        postedAt: post.createdAt,
        contentHash: post.contentHash,
      });

      redditCount++;
    }

    console.log(`[SocialMonitor] Found ${redditCount} new Reddit posts`);
  } catch (error) {
    console.error("[SocialMonitor] Reddit error:", error);
  }

  return {
    paperId,
    arxivId,
    bluesky: blueskyCount,
    reddit: redditCount,
  };
}

export function createSocialMonitorWorker() {
  const worker = new Worker("social-monitor", processSocialMonitor, {
    connection: redisConnection,
    concurrency: 2,
    limiter: {
      max: 20,
      duration: 60000, // 20 jobs per minute
    },
  });

  worker.on("completed", (job, result) => {
    console.log(
      `[SocialMonitor] Job ${job.id} completed: ${result.bluesky} Bluesky, ${result.reddit} Reddit`
    );
  });

  worker.on("failed", (job, err) => {
    console.error(`[SocialMonitor] Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error("[SocialMonitor] Worker error:", err);
  });

  console.log("[SocialMonitor] Started");

  return worker;
}
