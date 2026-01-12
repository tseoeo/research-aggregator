/**
 * Bluesky API Service
 *
 * Searches for posts mentioning research papers on Bluesky.
 * Uses the public AT Protocol API - no authentication required for search.
 *
 * API Docs: https://docs.bsky.app/docs/api/app-bsky-feed-search-posts
 */

import { createHash } from "crypto";

const BSKY_PUBLIC_API = "https://public.api.bsky.app";

export interface BlueskyPost {
  uri: string;
  cid: string;
  authorHandle: string;
  authorName: string;
  authorAvatar?: string;
  content: string;
  createdAt: Date;
  likes: number;
  reposts: number;
  replies: number;
  url: string;
  contentHash: string;
}

interface BskySearchResponse {
  posts: {
    uri: string;
    cid: string;
    author: {
      did: string;
      handle: string;
      displayName?: string;
      avatar?: string;
    };
    record: {
      text: string;
      createdAt: string;
    };
    likeCount?: number;
    repostCount?: number;
    replyCount?: number;
  }[];
  cursor?: string;
}

/**
 * Generate a content hash for deduplication
 */
function generateContentHash(content: string, authorHandle: string): string {
  const normalized = `${authorHandle}:${content.toLowerCase().trim()}`;
  return createHash("sha256").update(normalized).digest("hex").slice(0, 16);
}

/**
 * Convert Bluesky URI to web URL
 */
function uriToUrl(uri: string, handle: string): string {
  // URI format: at://did:plc:xxx/app.bsky.feed.post/yyy
  const parts = uri.split("/");
  const postId = parts[parts.length - 1];
  return `https://bsky.app/profile/${handle}/post/${postId}`;
}

export class BlueskyService {
  /**
   * Search for posts mentioning a query (paper title, arXiv ID, etc.)
   */
  async searchPosts(query: string, limit: number = 25): Promise<BlueskyPost[]> {
    try {
      const params = new URLSearchParams({
        q: query,
        limit: limit.toString(),
        sort: "latest",
      });

      const response = await fetch(
        `${BSKY_PUBLIC_API}/xrpc/app.bsky.feed.searchPosts?${params}`,
        {
          headers: {
            "Accept": "application/json",
          },
        }
      );

      if (!response.ok) {
        if (response.status === 429) {
          console.warn("[Bluesky] Rate limited, will retry later");
          return [];
        }
        throw new Error(`Bluesky API error: ${response.status}`);
      }

      const data: BskySearchResponse = await response.json();

      return data.posts.map((post) => ({
        uri: post.uri,
        cid: post.cid,
        authorHandle: post.author.handle,
        authorName: post.author.displayName || post.author.handle,
        authorAvatar: post.author.avatar,
        content: post.record.text,
        createdAt: new Date(post.record.createdAt),
        likes: post.likeCount || 0,
        reposts: post.repostCount || 0,
        replies: post.replyCount || 0,
        url: uriToUrl(post.uri, post.author.handle),
        contentHash: generateContentHash(post.record.text, post.author.handle),
      }));
    } catch (error) {
      console.error("[Bluesky] Search error:", error);
      return [];
    }
  }

  /**
   * Search for posts about a specific paper
   */
  async searchForPaper(
    title: string,
    arxivId: string
  ): Promise<BlueskyPost[]> {
    const posts: BlueskyPost[] = [];
    const seenHashes = new Set<string>();

    // Search by arXiv ID (most specific)
    const arxivPosts = await this.searchPosts(arxivId, 10);
    for (const post of arxivPosts) {
      if (!seenHashes.has(post.contentHash)) {
        seenHashes.add(post.contentHash);
        posts.push(post);
      }
    }

    // Search by paper title (first 50 chars to avoid query limits)
    const titleQuery = title.slice(0, 50).replace(/[^\w\s]/g, " ");
    if (titleQuery.length > 10) {
      const titlePosts = await this.searchPosts(titleQuery, 10);
      for (const post of titlePosts) {
        if (!seenHashes.has(post.contentHash)) {
          seenHashes.add(post.contentHash);
          posts.push(post);
        }
      }
    }

    // Sort by engagement (likes + reposts)
    posts.sort((a, b) => (b.likes + b.reposts) - (a.likes + a.reposts));

    return posts;
  }

  /**
   * Get posts by a specific author handle
   */
  async getAuthorPosts(handle: string, limit: number = 20): Promise<BlueskyPost[]> {
    try {
      const params = new URLSearchParams({
        actor: handle,
        limit: limit.toString(),
      });

      const response = await fetch(
        `${BSKY_PUBLIC_API}/xrpc/app.bsky.feed.getAuthorFeed?${params}`,
        {
          headers: {
            "Accept": "application/json",
          },
        }
      );

      if (!response.ok) {
        return [];
      }

      const data = await response.json();

      return data.feed.map((item: any) => ({
        uri: item.post.uri,
        cid: item.post.cid,
        authorHandle: item.post.author.handle,
        authorName: item.post.author.displayName || item.post.author.handle,
        authorAvatar: item.post.author.avatar,
        content: item.post.record.text,
        createdAt: new Date(item.post.record.createdAt),
        likes: item.post.likeCount || 0,
        reposts: item.post.repostCount || 0,
        replies: item.post.replyCount || 0,
        url: uriToUrl(item.post.uri, item.post.author.handle),
        contentHash: generateContentHash(
          item.post.record.text,
          item.post.author.handle
        ),
      }));
    } catch (error) {
      console.error("[Bluesky] Get author posts error:", error);
      return [];
    }
  }
}

// Export singleton instance
export const blueskyService = new BlueskyService();
