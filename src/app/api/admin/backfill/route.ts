import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, paperSources } from "@/lib/db/schema";
import { summaryQueue, socialMonitorQueue, newsFetchQueue } from "@/lib/queue/queues";
import { eq, and } from "drizzle-orm";
import { AI_CATEGORIES } from "@/lib/services/arxiv";
import { verifyAdminAuth } from "@/lib/auth/admin";
import { isAiEnabledAsync, getAiStatusAsync, getAiStatusMessage } from "@/lib/ai/config";

export const dynamic = "force-dynamic";

const ARXIV_API_BASE = "https://export.arxiv.org/api/query";
const RATE_LIMIT_MS = 3000;

/**
 * Parse arXiv XML to extract papers
 */
function parseArxivXml(xml: string) {
  const papersData: Array<{
    arxivId: string;
    title: string;
    abstract: string;
    authors: Array<{ name: string; affiliation?: string }>;
    categories: string[];
    primaryCategory: string;
    publishedAt: Date;
    updatedAt: Date;
    pdfUrl: string;
  }> = [];

  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let entryMatch;

  while ((entryMatch = entryRegex.exec(xml)) !== null) {
    const entry = entryMatch[1];

    try {
      const idMatch = entry.match(/<id>https?:\/\/arxiv\.org\/abs\/([^<]+)<\/id>/);
      if (!idMatch) continue;
      const arxivId = idMatch[1].trim();

      const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
      const title = titleMatch ? titleMatch[1].replace(/\s+/g, " ").trim() : "";

      const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/);
      const abstract = summaryMatch ? summaryMatch[1].replace(/\s+/g, " ").trim() : "";

      const authors: Array<{ name: string; affiliation?: string }> = [];
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

      const categories: string[] = [];
      const categoryRegex = /<category[^>]*term="([^"]+)"[^>]*\/>/g;
      let categoryMatch;
      while ((categoryMatch = categoryRegex.exec(entry)) !== null) {
        categories.push(categoryMatch[1]);
      }

      const primaryCategoryMatch = entry.match(/<arxiv:primary_category[^>]*term="([^"]+)"[^>]*\/>/);
      const primaryCategory = primaryCategoryMatch ? primaryCategoryMatch[1] : categories[0] || "";

      const publishedMatch = entry.match(/<published>([^<]+)<\/published>/);
      const updatedMatch = entry.match(/<updated>([^<]+)<\/updated>/);
      const publishedAt = publishedMatch ? new Date(publishedMatch[1]) : new Date();
      const updatedAt = updatedMatch ? new Date(updatedMatch[1]) : publishedAt;

      const pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;

      papersData.push({
        arxivId,
        title,
        abstract,
        authors,
        categories,
        primaryCategory,
        publishedAt,
        updatedAt,
        pdfUrl,
      });
    } catch {
      continue;
    }
  }

  return papersData;
}

/**
 * Ensure arXiv source exists
 */
async function ensureArxivSource(): Promise<number> {
  const existing = await db
    .select({ id: paperSources.id })
    .from(paperSources)
    .where(eq(paperSources.name, "arxiv"))
    .limit(1);

  if (existing.length > 0) return existing[0].id;

  const result = await db
    .insert(paperSources)
    .values({ name: "arxiv", baseUrl: "https://arxiv.org", isActive: true })
    .returning({ id: paperSources.id });

  return result[0].id;
}

/**
 * POST /api/admin/backfill
 *
 * Backfill papers from all AI categories with pagination.
 *
 * Authentication: Authorization: Bearer <ADMIN_SECRET>
 *
 * Query params:
 * - count: number of papers to fetch (default 500)
 */
export async function POST(request: NextRequest) {
  // Verify admin auth via Authorization header
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) {
    return auth.error;
  }

  // Check if AI is enabled (runtime toggle)
  if (!(await isAiEnabledAsync(true))) {
    const status = await getAiStatusAsync();
    return NextResponse.json(
      {
        error: "AI processing is not available",
        message: getAiStatusMessage(status),
        hint: "Enable AI from the admin panel or set AI_ENABLED=true"
      },
      { status: 503 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const targetCount = parseInt(searchParams.get("count") || "500", 10);
    const perPage = 100; // arXiv API max per request
    const pages = Math.ceil(targetCount / perPage);

    console.log(`[Backfill] Starting backfill of ${targetCount} papers from all AI categories`);

    const sourceId = await ensureArxivSource();
    const categoryQuery = AI_CATEGORIES.map((c) => `cat:${c}`).join(" OR ");

    let totalFetched = 0;
    let totalNew = 0;
    let queuedSummaries = 0;

    for (let page = 0; page < pages; page++) {
      const start = page * perPage;
      const maxResults = Math.min(perPage, targetCount - totalFetched);

      // Build URL manually to avoid issues
      const queryStr = encodeURIComponent(`(${categoryQuery})`);
      const apiUrl = `${ARXIV_API_BASE}?search_query=${queryStr}&start=${start}&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;

      console.log(`[Backfill] Fetching page ${page + 1}/${pages} (start=${start}, max=${maxResults})`);
      console.log(`[Backfill] URL: ${apiUrl}`);

      let response;
      try {
        response = await fetch(apiUrl, {
          headers: { "User-Agent": "ResearchAggregator/1.0 (backfill)" },
        });
      } catch (fetchError) {
        console.error(`[Backfill] Fetch error:`, fetchError);
        return NextResponse.json({
          error: "Fetch failed",
          details: String(fetchError),
          url: apiUrl
        }, { status: 500 });
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[Backfill] arXiv API error: ${response.status} - ${errorText}`);
        return NextResponse.json({
          error: "arXiv API error",
          status: response.status,
          details: errorText.substring(0, 500)
        }, { status: 500 });
      }

      const xml = await response.text();
      console.log(`[Backfill] Got XML response, length: ${xml.length}`);

      if (xml.includes("Rate exceeded")) {
        console.error(`[Backfill] Rate limited by arXiv`);
        return NextResponse.json({
          error: "Rate limited by arXiv API",
          totalFetched,
          newPapers: totalNew,
          message: "Try again in a few minutes"
        }, { status: 429 });
      }

      const fetchedPapers = parseArxivXml(xml);
      console.log(`[Backfill] Parsed ${fetchedPapers.length} papers from XML`);
      totalFetched += fetchedPapers.length;

      console.log(`[Backfill] Page ${page + 1}: fetched ${fetchedPapers.length} papers`);

      // Process each paper
      for (const paper of fetchedPapers) {
        // Use onConflictDoNothing to handle race conditions - if another process
        // inserted the same paper between our check and insert, we skip it
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
          .onConflictDoNothing({
            target: [papers.sourceId, papers.externalId],
          })
          .returning({ id: papers.id });

        // If no row returned, paper already existed - skip
        if (result.length === 0) continue;

        totalNew++;

        // Queue for summary generation (staggered)
        await summaryQueue.add(
          "backfill-summary",
          {
            paperId: result[0].id,
            arxivId: paper.arxivId,
            title: paper.title,
            abstract: paper.abstract,
          },
          { delay: queuedSummaries * 2000 } // 2 seconds between each
        );

        // Queue for social monitoring
        await socialMonitorQueue.add(
          "backfill-social",
          {
            paperId: result[0].id,
            arxivId: paper.arxivId,
            title: paper.title,
          },
          { delay: queuedSummaries * 3000 }
        );

        // Queue for news
        await newsFetchQueue.add(
          "backfill-news",
          {
            paperId: result[0].id,
            arxivId: paper.arxivId,
            title: paper.title,
            priority: "low",
          },
          { delay: queuedSummaries * 5000 }
        );

        queuedSummaries++;
      }

      // Rate limit between pages
      if (page < pages - 1) {
        await new Promise((resolve) => setTimeout(resolve, RATE_LIMIT_MS));
      }
    }

    console.log(`[Backfill] Complete: fetched=${totalFetched}, new=${totalNew}, queued=${queuedSummaries}`);

    return NextResponse.json({
      success: true,
      totalFetched,
      newPapers: totalNew,
      queuedJobs: queuedSummaries,
      message: `Backfilled ${totalNew} new papers from ${AI_CATEGORIES.join(", ")}. ${queuedSummaries} jobs queued for AI summaries.`,
    });
  } catch (error) {
    console.error("[Backfill] Error:", error);
    return NextResponse.json({ error: "Backfill failed" }, { status: 500 });
  }
}

/**
 * GET /api/admin/backfill - Show backfill status/info
 *
 * Authentication: Authorization: Bearer <ADMIN_SECRET>
 */
export async function GET(request: NextRequest) {
  // Verify admin auth via Authorization header
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) {
    return auth.error;
  }

  return NextResponse.json({
    endpoint: "POST /api/admin/backfill",
    description: "Backfill papers from all AI categories",
    authentication: "Authorization: Bearer <ADMIN_SECRET>",
    params: {
      count: "Number of papers to fetch (default: 500)",
    },
    categories: AI_CATEGORIES,
    aiStatus: getAiStatusMessage(),
  });
}
