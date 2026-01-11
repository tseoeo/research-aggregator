/**
 * Twitter/X Service
 *
 * Searches for tweets mentioning research papers.
 *
 * Since the official Twitter API is very expensive ($42K+/year),
 * this service is designed to work with external scraping services.
 *
 * Supported backends:
 * 1. Scrapingdog Twitter Scraper API (recommended, ~$0.0003/request)
 * 2. Manual/mock data for development
 *
 * Configure via environment variable:
 * TWITTER_SCRAPER_API_KEY - API key for scraping service
 * TWITTER_SCRAPER_URL - Custom scraper endpoint (optional)
 */

import { createHash } from "crypto";

export interface Tweet {
  id: string;
  authorHandle: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: Date;
  likes: number;
  retweets: number;
  replies: number;
  url: string;
  contentHash: string;
}

interface ScrapingdogResponse {
  tweets: {
    id: string;
    user: {
      screen_name: string;
      name: string;
      profile_image_url_https?: string;
    };
    full_text: string;
    created_at: string;
    favorite_count: number;
    retweet_count: number;
    reply_count: number;
  }[];
}

/**
 * Generate a content hash for deduplication
 */
function generateContentHash(content: string, author: string): string {
  const normalized = `${author}:${content.toLowerCase().trim().slice(0, 200)}`;
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

export class TwitterService {
  private apiKey: string | null;
  private scraperUrl: string;

  constructor() {
    this.apiKey = process.env.TWITTER_SCRAPER_API_KEY || null;
    this.scraperUrl =
      process.env.TWITTER_SCRAPER_URL ||
      "https://api.scrapingdog.com/twitter";
  }

  /**
   * Check if the service is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Search for tweets matching a query
   */
  async searchTweets(query: string, limit: number = 20): Promise<Tweet[]> {
    if (!this.isConfigured()) {
      console.warn("[Twitter] Scraper not configured, skipping");
      return [];
    }

    try {
      const params = new URLSearchParams({
        api_key: this.apiKey!,
        query: query,
        count: limit.toString(),
        type: "search",
      });

      const response = await fetch(`${this.scraperUrl}?${params}`, {
        headers: {
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.warn("[Twitter] Rate limited");
          return [];
        }
        throw new Error(`Twitter scraper error: ${response.status}`);
      }

      const data: ScrapingdogResponse = await response.json();

      if (!data.tweets || !Array.isArray(data.tweets)) {
        return [];
      }

      return data.tweets.map((tweet) => ({
        id: tweet.id,
        authorHandle: tweet.user.screen_name,
        authorName: tweet.user.name,
        authorAvatar: tweet.user.profile_image_url_https,
        content: tweet.full_text,
        createdAt: new Date(tweet.created_at),
        likes: tweet.favorite_count,
        retweets: tweet.retweet_count,
        replies: tweet.reply_count,
        url: `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id}`,
        contentHash: generateContentHash(tweet.full_text, tweet.user.screen_name),
      }));
    } catch (error) {
      console.error("[Twitter] Search error:", error);
      return [];
    }
  }

  /**
   * Search for tweets about a specific paper
   */
  async searchForPaper(
    title: string,
    arxivId: string
  ): Promise<Tweet[]> {
    if (!this.isConfigured()) {
      return [];
    }

    const tweets: Tweet[] = [];
    const seenHashes = new Set<string>();

    // Search by arXiv ID
    const arxivTweets = await this.searchTweets(arxivId, 10);
    for (const tweet of arxivTweets) {
      if (!seenHashes.has(tweet.contentHash)) {
        seenHashes.add(tweet.contentHash);
        tweets.push(tweet);
      }
    }

    // Search by arXiv URL
    const arxivUrlTweets = await this.searchTweets(
      `arxiv.org/abs/${arxivId}`,
      10
    );
    for (const tweet of arxivUrlTweets) {
      if (!seenHashes.has(tweet.contentHash)) {
        seenHashes.add(tweet.contentHash);
        tweets.push(tweet);
      }
    }

    // Sort by engagement
    tweets.sort((a, b) => (b.likes + b.retweets) - (a.likes + a.retweets));

    return tweets;
  }

  /**
   * Get tweets from a specific user
   */
  async getUserTweets(handle: string, limit: number = 20): Promise<Tweet[]> {
    if (!this.isConfigured()) {
      return [];
    }

    try {
      const params = new URLSearchParams({
        api_key: this.apiKey!,
        username: handle,
        count: limit.toString(),
        type: "profile",
      });

      const response = await fetch(`${this.scraperUrl}?${params}`, {
        headers: {
          "Accept": "application/json",
        },
      });

      if (!response.ok) {
        return [];
      }

      const data: ScrapingdogResponse = await response.json();

      if (!data.tweets || !Array.isArray(data.tweets)) {
        return [];
      }

      return data.tweets.map((tweet) => ({
        id: tweet.id,
        authorHandle: tweet.user.screen_name,
        authorName: tweet.user.name,
        authorAvatar: tweet.user.profile_image_url_https,
        content: tweet.full_text,
        createdAt: new Date(tweet.created_at),
        likes: tweet.favorite_count,
        retweets: tweet.retweet_count,
        replies: tweet.reply_count,
        url: `https://twitter.com/${tweet.user.screen_name}/status/${tweet.id}`,
        contentHash: generateContentHash(tweet.full_text, tweet.user.screen_name),
      }));
    } catch (error) {
      console.error("[Twitter] Get user tweets error:", error);
      return [];
    }
  }
}

// Export singleton instance
export const twitterService = new TwitterService();
