/**
 * Social Aggregator Service
 *
 * Aggregates mentions from all social platforms and handles deduplication.
 */

import { blueskyService, BlueskyPost } from "./bluesky";
import { redditService, RedditPost } from "./reddit";
import { twitterService, Tweet } from "./twitter";

export type Platform = "bluesky" | "reddit" | "twitter";

export interface SocialMention {
  id: string;
  platform: Platform;
  externalId: string;
  authorHandle: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  url: string;
  postedAt: Date;
  likes: number;
  reposts: number;
  replies: number;
  contentHash: string;
  // Additional metadata
  subreddit?: string; // For Reddit
  postTitle?: string; // For Reddit
}

/**
 * Convert BlueskyPost to SocialMention
 */
function blueskyToMention(post: BlueskyPost): SocialMention {
  return {
    id: `bluesky-${post.cid}`,
    platform: "bluesky",
    externalId: post.uri,
    authorHandle: post.authorHandle,
    authorName: post.authorName,
    authorAvatar: post.authorAvatar,
    content: post.content,
    url: post.url,
    postedAt: post.createdAt,
    likes: post.likes,
    reposts: post.reposts,
    replies: post.replies,
    contentHash: post.contentHash,
  };
}

/**
 * Convert RedditPost to SocialMention
 */
function redditToMention(post: RedditPost): SocialMention {
  return {
    id: `reddit-${post.id}`,
    platform: "reddit",
    externalId: post.id,
    authorHandle: post.authorName,
    authorName: post.authorName,
    content: post.content || post.title,
    url: post.permalink,
    postedAt: post.createdAt,
    likes: post.score,
    reposts: 0,
    replies: post.numComments,
    contentHash: post.contentHash,
    subreddit: post.subreddit,
    postTitle: post.title,
  };
}

/**
 * Convert Tweet to SocialMention
 */
function tweetToMention(tweet: Tweet): SocialMention {
  return {
    id: `twitter-${tweet.id}`,
    platform: "twitter",
    externalId: tweet.id,
    authorHandle: tweet.authorHandle,
    authorName: tweet.authorName,
    authorAvatar: tweet.authorAvatar,
    content: tweet.content,
    url: tweet.url,
    postedAt: tweet.createdAt,
    likes: tweet.likes,
    reposts: tweet.retweets,
    replies: tweet.replies,
    contentHash: tweet.contentHash,
  };
}

export class SocialAggregatorService {
  /**
   * Fetch mentions for a paper from all platforms
   */
  async fetchMentionsForPaper(
    title: string,
    arxivId: string,
    options: {
      platforms?: Platform[];
      deduplicateAcrossPlatforms?: boolean;
    } = {}
  ): Promise<SocialMention[]> {
    const {
      platforms = ["bluesky", "reddit", "twitter"],
      deduplicateAcrossPlatforms = true,
    } = options;

    const mentions: SocialMention[] = [];
    const seenHashes = new Set<string>();

    // Fetch from each platform in parallel
    const promises: Promise<SocialMention[]>[] = [];

    if (platforms.includes("bluesky")) {
      promises.push(
        blueskyService
          .searchForPaper(title, arxivId)
          .then((posts) => posts.map(blueskyToMention))
      );
    }

    if (platforms.includes("reddit")) {
      promises.push(
        redditService
          .searchForPaper(title, arxivId)
          .then((posts) => posts.map(redditToMention))
      );
    }

    if (platforms.includes("twitter")) {
      promises.push(
        twitterService
          .searchForPaper(title, arxivId)
          .then((tweets) => tweets.map(tweetToMention))
      );
    }

    const results = await Promise.allSettled(promises);

    for (const result of results) {
      if (result.status === "fulfilled") {
        for (const mention of result.value) {
          if (deduplicateAcrossPlatforms) {
            // Skip if we've seen very similar content
            if (!seenHashes.has(mention.contentHash)) {
              seenHashes.add(mention.contentHash);
              mentions.push(mention);
            }
          } else {
            mentions.push(mention);
          }
        }
      } else {
        console.error("Platform fetch failed:", result.reason);
      }
    }

    // Sort by engagement (likes + reposts)
    mentions.sort((a, b) => (b.likes + b.reposts) - (a.likes + a.reposts));

    return mentions;
  }

  /**
   * Fetch mentions grouped by platform
   */
  async fetchMentionsByPlatform(
    title: string,
    arxivId: string
  ): Promise<Record<Platform, SocialMention[]>> {
    const [blueskyPosts, redditPosts, tweets] = await Promise.allSettled([
      blueskyService.searchForPaper(title, arxivId),
      redditService.searchForPaper(title, arxivId),
      twitterService.searchForPaper(title, arxivId),
    ]);

    return {
      bluesky:
        blueskyPosts.status === "fulfilled"
          ? blueskyPosts.value.map(blueskyToMention)
          : [],
      reddit:
        redditPosts.status === "fulfilled"
          ? redditPosts.value.map(redditToMention)
          : [],
      twitter:
        tweets.status === "fulfilled"
          ? tweets.value.map(tweetToMention)
          : [],
    };
  }

  /**
   * Get statistics about mentions
   */
  getMentionStats(mentions: SocialMention[]): {
    total: number;
    byPlatform: Record<Platform, number>;
    totalEngagement: number;
  } {
    const byPlatform: Record<Platform, number> = {
      bluesky: 0,
      reddit: 0,
      twitter: 0,
    };

    let totalEngagement = 0;

    for (const mention of mentions) {
      byPlatform[mention.platform]++;
      totalEngagement += mention.likes + mention.reposts + mention.replies;
    }

    return {
      total: mentions.length,
      byPlatform,
      totalEngagement,
    };
  }
}

// Export singleton instance
export const socialAggregatorService = new SocialAggregatorService();
