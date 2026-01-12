/**
 * Reddit API Service
 *
 * Searches for posts mentioning research papers on Reddit.
 * Uses the public JSON API (no authentication required for search).
 *
 * Relevant subreddits for AI research:
 * - r/MachineLearning
 * - r/artificial
 * - r/deeplearning
 * - r/LanguageTechnology
 * - r/computervision
 */

import { createHash } from "crypto";

const REDDIT_API = "https://www.reddit.com";

// Subreddits relevant for AI research
const AI_SUBREDDITS = [
  "MachineLearning",
  "artificial",
  "deeplearning",
  "LanguageTechnology",
  "computervision",
  "LocalLLaMA",
  "singularity",
];

export interface RedditPost {
  id: string;
  subreddit: string;
  title: string;
  content: string;
  authorName: string;
  score: number;
  numComments: number;
  createdAt: Date;
  url: string;
  permalink: string;
  isComment: boolean;
  contentHash: string;
}

interface RedditSearchResponse {
  data: {
    children: {
      kind: string;
      data: {
        id: string;
        subreddit: string;
        title?: string;
        selftext?: string;
        body?: string;
        author: string;
        score: number;
        num_comments?: number;
        created_utc: number;
        permalink: string;
        url?: string;
      };
    }[];
    after?: string;
  };
}

/**
 * Generate a content hash for deduplication
 */
function generateContentHash(content: string, author: string): string {
  const normalized = `${author}:${content.toLowerCase().trim().slice(0, 200)}`;
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

/**
 * Rate limiter to respect Reddit's API limits
 */
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1000; // 1 second between requests

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    await new Promise((resolve) =>
      setTimeout(resolve, MIN_REQUEST_INTERVAL - timeSinceLastRequest)
    );
  }

  lastRequestTime = Date.now();

  return fetch(url, {
    headers: {
      "User-Agent": "ResearchAggregator/1.0",
      "Accept": "application/json",
    },
  });
}

export class RedditService {
  /**
   * Search Reddit for posts matching a query
   */
  async searchPosts(
    query: string,
    subreddit?: string,
    limit: number = 25
  ): Promise<RedditPost[]> {
    try {
      const params = new URLSearchParams({
        q: query,
        sort: "relevance",
        t: "month", // Time filter: last month
        limit: limit.toString(),
        type: "link", // Posts only, not comments
      });

      if (subreddit) {
        params.set("restrict_sr", "true");
      }

      const endpoint = subreddit
        ? `${REDDIT_API}/r/${subreddit}/search.json`
        : `${REDDIT_API}/search.json`;

      const response = await rateLimitedFetch(`${endpoint}?${params}`);

      if (!response.ok) {
        if (response.status === 429) {
          console.warn("[Reddit] Rate limited");
          return [];
        }
        throw new Error(`Reddit API error: ${response.status}`);
      }

      const data: RedditSearchResponse = await response.json();

      return data.data.children.map((child) => {
        const post = child.data;
        const content = post.selftext || post.title || "";

        return {
          id: post.id,
          subreddit: post.subreddit,
          title: post.title || "",
          content: content,
          authorName: post.author,
          score: post.score,
          numComments: post.num_comments || 0,
          createdAt: new Date(post.created_utc * 1000),
          url: post.url || `https://reddit.com${post.permalink}`,
          permalink: `https://reddit.com${post.permalink}`,
          isComment: false,
          contentHash: generateContentHash(content, post.author),
        };
      });
    } catch (error) {
      console.error("[Reddit] Search error:", error);
      return [];
    }
  }

  /**
   * Search for posts about a specific paper across AI subreddits
   */
  async searchForPaper(
    title: string,
    arxivId: string
  ): Promise<RedditPost[]> {
    const posts: RedditPost[] = [];
    const seenHashes = new Set<string>();

    // Search by arXiv ID across all Reddit
    const arxivPosts = await this.searchPosts(arxivId, undefined, 10);
    for (const post of arxivPosts) {
      if (!seenHashes.has(post.contentHash)) {
        seenHashes.add(post.contentHash);
        posts.push(post);
      }
    }

    // Search by paper title in ML subreddit (most active)
    const titleQuery = title.slice(0, 60).replace(/[^\w\s]/g, " ");
    if (titleQuery.length > 10) {
      const titlePosts = await this.searchPosts(
        titleQuery,
        "MachineLearning",
        10
      );
      for (const post of titlePosts) {
        if (!seenHashes.has(post.contentHash)) {
          seenHashes.add(post.contentHash);
          posts.push(post);
        }
      }
    }

    // Sort by score (upvotes)
    posts.sort((a, b) => b.score - a.score);

    return posts;
  }

  /**
   * Search across multiple AI-related subreddits
   */
  async searchAISubreddits(query: string): Promise<RedditPost[]> {
    const allPosts: RedditPost[] = [];
    const seenHashes = new Set<string>();

    // Search top 3 subreddits to avoid rate limiting
    const subredditsToSearch = AI_SUBREDDITS.slice(0, 3);

    for (const subreddit of subredditsToSearch) {
      const posts = await this.searchPosts(query, subreddit, 10);
      for (const post of posts) {
        if (!seenHashes.has(post.contentHash)) {
          seenHashes.add(post.contentHash);
          allPosts.push(post);
        }
      }
    }

    // Sort by score
    allPosts.sort((a, b) => b.score - a.score);

    return allPosts;
  }

  /**
   * Get comments from a specific post
   */
  async getPostComments(
    subreddit: string,
    postId: string,
    limit: number = 10
  ): Promise<RedditPost[]> {
    try {
      const response = await rateLimitedFetch(
        `${REDDIT_API}/r/${subreddit}/comments/${postId}.json?limit=${limit}&sort=top`
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();

      // Comments are in the second element of the response array
      if (!data[1]?.data?.children) {
        return [];
      }

      return data[1].data.children
        .filter((child: any) => child.kind === "t1") // t1 = comment
        .map((child: any) => {
          const comment = child.data;
          return {
            id: comment.id,
            subreddit: comment.subreddit,
            title: "",
            content: comment.body || "",
            authorName: comment.author,
            score: comment.score,
            numComments: 0,
            createdAt: new Date(comment.created_utc * 1000),
            url: `https://reddit.com${comment.permalink}`,
            permalink: `https://reddit.com${comment.permalink}`,
            isComment: true,
            contentHash: generateContentHash(comment.body || "", comment.author),
          };
        });
    } catch (error) {
      console.error("[Reddit] Get comments error:", error);
      return [];
    }
  }
}

// Export singleton instance
export const redditService = new RedditService();
