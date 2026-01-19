/**
 * ArXiv API Service
 *
 * Fetches papers from the arXiv API.
 * API Docs: https://info.arxiv.org/help/api/user-manual.html
 *
 * Rate Limits:
 * - No more than 1 request every 3 seconds
 * - Single connection at a time
 */

import { z } from "zod";

// Validation schema for arXiv paper
const arxivAuthorSchema = z.object({
  name: z.string(),
  affiliation: z.string().optional(),
});

const arxivPaperSchema = z.object({
  arxivId: z.string(),
  title: z.string(),
  abstract: z.string(),
  authors: z.array(arxivAuthorSchema),
  categories: z.array(z.string()),
  primaryCategory: z.string(),
  publishedAt: z.date(),
  updatedAt: z.date(),
  pdfUrl: z.string(),
  doiUrl: z.string().optional(),
});

export type ArxivPaper = z.infer<typeof arxivPaperSchema>;
export type ArxivAuthor = z.infer<typeof arxivAuthorSchema>;

// arXiv category mappings for AI-related papers
export const AI_CATEGORIES = [
  "cs.AI",   // Artificial Intelligence
  "cs.LG",   // Machine Learning
  "cs.CL",   // Computation and Language (NLP)
  "cs.CV",   // Computer Vision
  "cs.NE",   // Neural and Evolutionary Computing
  "stat.ML", // Machine Learning (Statistics)
] as const;

const ARXIV_API_BASE = "https://export.arxiv.org/api/query";
const RATE_LIMIT_MS = 3000; // 3 seconds between requests
const FETCH_TIMEOUT_MS = 30000; // 30 second timeout for API calls (increased from 10s)

let lastRequestTime = 0;

/**
 * Enforces rate limiting by waiting if needed
 * In serverless environments, this is best-effort
 */
async function enforceRateLimit(): Promise<void> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < RATE_LIMIT_MS) {
    const waitTime = Math.min(RATE_LIMIT_MS - timeSinceLastRequest, RATE_LIMIT_MS);
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
}

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Parse XML response from arXiv API
 */
function parseArxivXml(xml: string): ArxivPaper[] {
  const papers: ArxivPaper[] = [];

  // Match all entry elements
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let entryMatch;

  while ((entryMatch = entryRegex.exec(xml)) !== null) {
    const entry = entryMatch[1];

    try {
      // Extract arXiv ID from <id> tag
      const idMatch = entry.match(/<id>https?:\/\/arxiv\.org\/abs\/([^<]+)<\/id>/);
      if (!idMatch) continue;
      const arxivId = idMatch[1].trim();

      // Extract title (remove newlines and extra spaces)
      const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
      const title = titleMatch
        ? titleMatch[1].replace(/\s+/g, " ").trim()
        : "";

      // Extract abstract/summary
      const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/);
      const abstract = summaryMatch
        ? summaryMatch[1].replace(/\s+/g, " ").trim()
        : "";

      // Extract authors
      const authors: ArxivAuthor[] = [];
      const authorRegex = /<author>([\s\S]*?)<\/author>/g;
      let authorMatch;

      while ((authorMatch = authorRegex.exec(entry)) !== null) {
        const authorEntry = authorMatch[1];
        const nameMatch = authorEntry.match(/<name>([^<]+)<\/name>/);
        const affiliationMatch = authorEntry.match(/<arxiv:affiliation[^>]*>([^<]+)<\/arxiv:affiliation>/);

        if (nameMatch) {
          authors.push({
            name: nameMatch[1].trim(),
            affiliation: affiliationMatch ? affiliationMatch[1].trim() : undefined,
          });
        }
      }

      // Extract categories
      const categories: string[] = [];
      const categoryRegex = /<category[^>]*term="([^"]+)"[^>]*\/>/g;
      let categoryMatch;

      while ((categoryMatch = categoryRegex.exec(entry)) !== null) {
        categories.push(categoryMatch[1]);
      }

      // Extract primary category
      const primaryCategoryMatch = entry.match(/<arxiv:primary_category[^>]*term="([^"]+)"[^>]*\/>/);
      const primaryCategory = primaryCategoryMatch
        ? primaryCategoryMatch[1]
        : categories[0] || "";

      // Extract dates
      const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);
      const updatedMatch = entry.match(/<updated>([^<]+)<\/updated>/);

      const publishedAt = publishedMatch
        ? new Date(publishedMatch[1])
        : new Date();
      const updatedAt = updatedMatch
        ? new Date(updatedMatch[1])
        : publishedAt;

      // Extract PDF link
      const pdfMatch = entry.match(/<link[^>]*title="pdf"[^>]*href="([^"]+)"[^>]*\/>/);
      const pdfUrl = pdfMatch
        ? pdfMatch[1]
        : `https://arxiv.org/pdf/${arxivId}.pdf`;

      // Extract DOI if present
      const doiMatch = entry.match(/<arxiv:doi[^>]*>([^<]+)<\/arxiv:doi>/);
      const doiUrl = doiMatch
        ? `https://doi.org/${doiMatch[1]}`
        : undefined;

      papers.push({
        arxivId,
        title,
        abstract,
        authors,
        categories,
        primaryCategory,
        publishedAt,
        updatedAt,
        pdfUrl,
        doiUrl,
      });
    } catch (error) {
      console.error("Error parsing arXiv entry:", error);
      continue;
    }
  }

  return papers;
}

/**
 * Build arXiv API query URL
 */
function buildQueryUrl(params: {
  searchQuery?: string;
  category?: string;
  categories?: string[];
  start?: number;
  maxResults?: number;
  sortBy?: "relevance" | "lastUpdatedDate" | "submittedDate";
  sortOrder?: "ascending" | "descending";
}): string {
  const {
    searchQuery,
    category,
    categories,
    start = 0,
    maxResults = 50,
    sortBy = "submittedDate",
    sortOrder = "descending",
  } = params;

  const queryParts: string[] = [];

  if (searchQuery) {
    queryParts.push(`all:${searchQuery}`);
  }

  if (category) {
    queryParts.push(`cat:${category}`);
  } else if (categories && categories.length > 0) {
    // Join multiple categories with OR
    const catQuery = categories.map((c) => `cat:${c}`).join(" OR ");
    queryParts.push(`(${catQuery})`);
  }

  const searchQueryStr = queryParts.join(" AND ") || "cat:cs.AI";

  const url = new URL(ARXIV_API_BASE);
  url.searchParams.set("search_query", searchQueryStr);
  url.searchParams.set("start", start.toString());
  url.searchParams.set("max_results", maxResults.toString());
  url.searchParams.set("sortBy", sortBy);
  url.searchParams.set("sortOrder", sortOrder);

  return url.toString();
}

export class ArxivService {
  /**
   * Fetch recent papers from arXiv by category
   */
  async fetchRecentPapers(
    category: string = "cs.AI",
    maxResults: number = 50
  ): Promise<ArxivPaper[]> {
    await enforceRateLimit();

    const url = buildQueryUrl({
      category,
      maxResults,
      sortBy: "submittedDate",
      sortOrder: "descending",
    });

    const response = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": "ResearchAggregator/1.0 (https://github.com/example/research-aggregator)",
      },
    });

    if (!response.ok) {
      throw new Error(`arXiv API error: ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();
    return parseArxivXml(xml);
  }

  /**
   * Fetch papers matching multiple AI-related categories
   */
  async fetchAIPapers(maxResults: number = 100): Promise<ArxivPaper[]> {
    await enforceRateLimit();

    const url = buildQueryUrl({
      categories: [...AI_CATEGORIES],
      maxResults,
      sortBy: "submittedDate",
      sortOrder: "descending",
    });

    const response = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": "ResearchAggregator/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`arXiv API error: ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();
    return parseArxivXml(xml);
  }

  /**
   * Fetch a specific paper by arXiv ID
   */
  async fetchPaperById(arxivId: string): Promise<ArxivPaper | null> {
    await enforceRateLimit();

    // Clean the ID (remove version if present for lookup)
    const cleanId = arxivId.replace(/v\d+$/, "");

    const url = `${ARXIV_API_BASE}?id_list=${cleanId}`;

    const response = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": "ResearchAggregator/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`arXiv API error: ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();
    const papers = parseArxivXml(xml);

    return papers[0] || null;
  }

  /**
   * Search papers by query string
   */
  async searchPapers(
    query: string,
    category?: string,
    maxResults: number = 50
  ): Promise<ArxivPaper[]> {
    await enforceRateLimit();

    const url = buildQueryUrl({
      searchQuery: query,
      category,
      maxResults,
      sortBy: "relevance",
    });

    const response = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": "ResearchAggregator/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`arXiv API error: ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();
    return parseArxivXml(xml);
  }

  /**
   * Fetch papers by date range for backfilling
   * Uses arXiv's submittedDate filter: submittedDate:[YYYYMMDD0000 TO YYYYMMDD2359]
   */
  async fetchByDateRange(
    startDate: Date,
    endDate: Date,
    category: string = "cs.AI",
    options: { maxResults?: number; start?: number } = {}
  ): Promise<{ papers: ArxivPaper[]; total: number }> {
    await enforceRateLimit();

    const { maxResults = 100, start = 0 } = options;

    // Format dates for arXiv API: YYYYMMDDTTTT (TTTT = time, use 0000 and 2359)
    const formatArxivDate = (date: Date, endOfDay: boolean = false): string => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const time = endOfDay ? "2359" : "0000";
      return `${year}${month}${day}${time}`;
    };

    const startStr = formatArxivDate(startDate, false);
    const endStr = formatArxivDate(endDate, true);

    // Build query with date filter
    const searchQuery = `cat:${category} AND submittedDate:[${startStr} TO ${endStr}]`;

    const url = new URL(ARXIV_API_BASE);
    url.searchParams.set("search_query", searchQuery);
    url.searchParams.set("start", start.toString());
    url.searchParams.set("max_results", maxResults.toString());
    url.searchParams.set("sortBy", "submittedDate");
    url.searchParams.set("sortOrder", "descending");

    console.log(`[ArxivService] Fetching ${category} from ${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}`);

    const response = await fetchWithTimeout(url.toString(), {
      headers: {
        "User-Agent": "ResearchAggregator/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`arXiv API error: ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();

    // Extract total results from opensearch:totalResults
    const totalMatch = xml.match(/<opensearch:totalResults[^>]*>(\d+)<\/opensearch:totalResults>/);
    const total = totalMatch ? parseInt(totalMatch[1], 10) : 0;

    const papers = parseArxivXml(xml);

    return { papers, total };
  }

  /**
   * Fetch papers with pagination support
   */
  async fetchPapersPaginated(
    category: string = "cs.AI",
    page: number = 0,
    perPage: number = 50
  ): Promise<{ papers: ArxivPaper[]; hasMore: boolean }> {
    await enforceRateLimit();

    // Fetch one extra to check if there are more
    const url = buildQueryUrl({
      category,
      start: page * perPage,
      maxResults: perPage + 1,
      sortBy: "submittedDate",
      sortOrder: "descending",
    });

    const response = await fetchWithTimeout(url, {
      headers: {
        "User-Agent": "ResearchAggregator/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`arXiv API error: ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();
    const papers = parseArxivXml(xml);

    const hasMore = papers.length > perPage;

    return {
      papers: papers.slice(0, perPage),
      hasMore,
    };
  }
}

// Export singleton instance
export const arxivService = new ArxivService();
