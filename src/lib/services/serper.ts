/**
 * Serper API Service
 *
 * Searches for news articles mentioning research papers.
 * Free tier: 2,500 queries/month
 *
 * API Docs: https://serper.dev/
 */

import { createHash } from "crypto";

const SERPER_API = "https://google.serper.dev";

export interface NewsArticle {
  title: string;
  snippet: string;
  url: string;
  source: string;
  date?: string;
  imageUrl?: string;
  urlHash: string;
}

interface SerperNewsResult {
  title: string;
  link: string;
  snippet: string;
  date?: string;
  source?: string;
  imageUrl?: string;
}

interface SerperNewsResponse {
  news?: SerperNewsResult[];
  organic?: SerperNewsResult[];
  searchParameters?: {
    q: string;
  };
}

/**
 * Generate URL hash for deduplication
 */
function generateUrlHash(url: string): string {
  return createHash("sha256").update(url.toLowerCase()).digest("hex").slice(0, 16);
}

export class SerperService {
  private apiKey: string | null;
  private enabled: boolean;

  constructor() {
    this.apiKey = process.env.SERPER_API_KEY || null;
    this.enabled = !!this.apiKey;

    if (!this.enabled) {
      console.warn("[Serper] API key not configured - news search disabled");
    }
  }

  /**
   * Check if the service is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Search for news articles about a paper
   */
  async searchNews(
    query: string,
    options: { limit?: number; daysAgo?: number } = {}
  ): Promise<NewsArticle[]> {
    if (!this.enabled || !this.apiKey) {
      return [];
    }

    try {
      const { limit = 10, daysAgo = 30 } = options;

      // Add time filter to query
      const timeFilter = daysAgo <= 7 ? "qdr:w" : daysAgo <= 30 ? "qdr:m" : "";

      const response = await fetch(`${SERPER_API}/news`, {
        method: "POST",
        headers: {
          "X-API-KEY": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: query,
          num: limit,
          tbs: timeFilter,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          console.warn("[Serper] Rate limited");
          return [];
        }
        if (response.status === 401) {
          console.error("[Serper] Invalid API key");
          this.enabled = false;
          return [];
        }
        throw new Error(`Serper API error: ${response.status}`);
      }

      const data: SerperNewsResponse = await response.json();

      const articles = data.news || [];

      return articles.map((article) => ({
        title: article.title,
        snippet: article.snippet || "",
        url: article.link,
        source: article.source || this.extractSource(article.link),
        date: article.date,
        imageUrl: article.imageUrl,
        urlHash: generateUrlHash(article.link),
      }));
    } catch (error) {
      console.error("[Serper] Search error:", error);
      return [];
    }
  }

  /**
   * Search for news about a specific paper
   */
  async searchForPaper(
    paperTitle: string,
    arxivId: string
  ): Promise<NewsArticle[]> {
    if (!this.enabled) {
      return [];
    }

    const articles: NewsArticle[] = [];
    const seenHashes = new Set<string>();

    // Search by arXiv ID
    const arxivArticles = await this.searchNews(`arxiv ${arxivId}`, { limit: 5 });
    for (const article of arxivArticles) {
      if (!seenHashes.has(article.urlHash)) {
        seenHashes.add(article.urlHash);
        articles.push(article);
      }
    }

    // Search by paper title (truncated)
    const titleQuery = paperTitle.slice(0, 80).replace(/[^\w\s]/g, " ");
    if (titleQuery.length > 20) {
      const titleArticles = await this.searchNews(`"${titleQuery}"`, { limit: 5 });
      for (const article of titleArticles) {
        if (!seenHashes.has(article.urlHash)) {
          seenHashes.add(article.urlHash);
          articles.push(article);
        }
      }
    }

    return articles;
  }

  /**
   * Search for general AI research news
   */
  async searchAINews(limit: number = 20): Promise<NewsArticle[]> {
    if (!this.enabled) {
      return [];
    }

    const queries = [
      "AI research breakthrough",
      "machine learning paper",
      "artificial intelligence study",
    ];

    const articles: NewsArticle[] = [];
    const seenHashes = new Set<string>();

    for (const query of queries) {
      const results = await this.searchNews(query, {
        limit: Math.ceil(limit / queries.length),
        daysAgo: 7,
      });

      for (const article of results) {
        if (!seenHashes.has(article.urlHash)) {
          seenHashes.add(article.urlHash);
          articles.push(article);
        }
      }

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    return articles.slice(0, limit);
  }

  /**
   * Extract source name from URL
   */
  private extractSource(url: string): string {
    try {
      const hostname = new URL(url).hostname;
      // Remove www. and get main domain
      const domain = hostname.replace(/^www\./, "");
      // Capitalize first letter
      return domain.charAt(0).toUpperCase() + domain.slice(1);
    } catch {
      return "Unknown";
    }
  }
}

// Export singleton instance
export const serperService = new SerperService();
