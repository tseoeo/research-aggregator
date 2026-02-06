/**
 * GET /api/papers/feed
 *
 * Feed API with v3 analysis filters, sorting, and pagination.
 * Returns papers with inline v3 analysis, author data, and social mention counts.
 *
 * Query params:
 *   kind      - Filter by what_kind (e.g., "New Method")
 *   areas     - Comma-separated impact area tags (OR logic)
 *   minValue  - Minimum practical_value_total (0-6)
 *   readiness - Filter by readiness_level
 *   timeline  - Filter by time_to_value
 *   category  - arXiv category (default: cs.AI)
 *   sort      - newest | value | discussed (default: newest)
 *   page      - Page number (default: 1)
 *   pageSize  - Items per page (default: 20, max: 100)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  papers,
  paperAnalysesV3,
  paperAuthors,
  authors,
  socialMentions,
} from "@/lib/db/schema";
import {
  eq,
  desc,
  asc,
  sql,
  and,
  arrayContains,
  inArray,
  gte,
  isNotNull,
} from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse params
    const kind = searchParams.get("kind");
    const areasParam = searchParams.get("areas");
    const minValueParam = searchParams.get("minValue");
    const readiness = searchParams.get("readiness");
    const timeline = searchParams.get("timeline");
    const category = searchParams.get("category") || "cs.AI";
    const sort = searchParams.get("sort") || "newest";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));

    const areas = areasParam ? areasParam.split(",").map((a) => a.trim()).filter(Boolean) : [];
    const minValue = minValueParam ? parseInt(minValueParam) : null;

    // Determine if analysis-specific filters are active
    const hasAnalysisFilters = !!(kind || areas.length > 0 || (minValue !== null && minValue > 0) || readiness || timeline);

    // Build WHERE conditions
    const conditions: ReturnType<typeof eq>[] = [];

    // Always filter by category
    conditions.push(sql`${papers.categories} @> ARRAY[${category}]::text[]`);

    // Analysis-specific filters
    if (hasAnalysisFilters) {
      // When analysis filters are active, only show papers with analysis
      conditions.push(isNotNull(paperAnalysesV3.id));
    }

    if (kind) {
      conditions.push(eq(paperAnalysesV3.whatKind, kind));
    }

    if (areas.length > 0) {
      // OR logic across selected tags: paper must have at least one of the selected tags
      const areaConditions = areas.map(
        (area) => sql`${paperAnalysesV3.impactAreaTags} @> ${JSON.stringify([area])}::jsonb`
      );
      conditions.push(sql`(${sql.join(areaConditions, sql` OR `)})`);
    }

    if (minValue !== null && minValue > 0) {
      conditions.push(gte(paperAnalysesV3.practicalValueTotal, minValue));
    }

    if (readiness) {
      conditions.push(eq(paperAnalysesV3.readinessLevel, readiness));
    }

    if (timeline) {
      conditions.push(eq(paperAnalysesV3.timeToValue, timeline));
    }

    // Count total matching papers
    const countResult = await db
      .select({ count: sql<number>`count(DISTINCT ${papers.id})::int` })
      .from(papers)
      .leftJoin(paperAnalysesV3, eq(papers.id, paperAnalysesV3.paperId))
      .where(and(...conditions));

    const total = countResult[0]?.count || 0;
    const totalPages = Math.ceil(total / pageSize);
    const offset = (page - 1) * pageSize;

    // Build ORDER BY
    let orderBy;
    switch (sort) {
      case "value":
        orderBy = sql`${paperAnalysesV3.practicalValueTotal} DESC NULLS LAST, ${papers.publishedAt} DESC`;
        break;
      case "discussed":
        // Subquery for social mention count
        orderBy = sql`(
          SELECT COUNT(*) FROM social_mentions sm WHERE sm.paper_id = ${papers.id}
        ) DESC, ${papers.publishedAt} DESC`;
        break;
      case "newest":
      default:
        orderBy = sql`${papers.publishedAt} DESC`;
        break;
    }

    // Fetch papers with v3 analysis
    const feedPapers = await db
      .selectDistinctOn([papers.id], {
        // Paper fields
        id: papers.id,
        externalId: papers.externalId,
        title: papers.title,
        abstract: papers.abstract,
        publishedAt: papers.publishedAt,
        primaryCategory: papers.primaryCategory,
        categories: papers.categories,
        pdfUrl: papers.pdfUrl,
        // V3 analysis fields (nullable — LEFT JOIN)
        analysisId: paperAnalysesV3.id,
        hookSentence: paperAnalysesV3.hookSentence,
        whatKind: paperAnalysesV3.whatKind,
        timeToValue: paperAnalysesV3.timeToValue,
        impactAreaTags: paperAnalysesV3.impactAreaTags,
        practicalValueScore: paperAnalysesV3.practicalValueScore,
        practicalValueTotal: paperAnalysesV3.practicalValueTotal,
        keyNumbers: paperAnalysesV3.keyNumbers,
        readinessLevel: paperAnalysesV3.readinessLevel,
        howThisChangesThings: paperAnalysesV3.howThisChangesThings,
        whatCameBefore: paperAnalysesV3.whatCameBefore,
        analysisStatus: paperAnalysesV3.analysisStatus,
      })
      .from(papers)
      .leftJoin(paperAnalysesV3, eq(papers.id, paperAnalysesV3.paperId))
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(pageSize)
      .offset(offset);

    if (feedPapers.length === 0) {
      return NextResponse.json({
        papers: [],
        total,
        page,
        pageSize,
        totalPages,
      });
    }

    // Batch fetch author data for "Who's Behind This"
    const paperIds = feedPapers.map((p) => p.id);

    const allAuthors = await db
      .select({
        paperId: paperAuthors.paperId,
        name: authors.name,
        position: paperAuthors.position,
        affiliation: paperAuthors.affiliation,
      })
      .from(paperAuthors)
      .innerJoin(authors, eq(paperAuthors.authorId, authors.id))
      .where(inArray(paperAuthors.paperId, paperIds))
      .orderBy(paperAuthors.paperId, asc(paperAuthors.position));

    // Group by paper: first author affiliation + total count
    const authorInfoByPaperId = new Map<string, { affiliation: string | null; count: number }>();
    for (const a of allAuthors) {
      const existing = authorInfoByPaperId.get(a.paperId);
      if (!existing) {
        authorInfoByPaperId.set(a.paperId, { affiliation: a.affiliation, count: 1 });
      } else {
        existing.count++;
      }
    }

    // Batch fetch social mention counts
    const mentionCounts = await db
      .select({
        paperId: socialMentions.paperId,
        count: sql<number>`count(*)::int`,
        totalEngagement: sql<number>`COALESCE(SUM(${socialMentions.likes} + ${socialMentions.reposts}), 0)::int`,
      })
      .from(socialMentions)
      .where(inArray(socialMentions.paperId, paperIds))
      .groupBy(socialMentions.paperId);

    const mentionsByPaperId = new Map<string, { count: number; totalEngagement: number }>();
    for (const m of mentionCounts) {
      mentionsByPaperId.set(m.paperId, { count: m.count, totalEngagement: m.totalEngagement });
    }

    // Assemble response
    const enrichedPapers = feedPapers.map((p) => {
      const authorInfo = authorInfoByPaperId.get(p.id);
      const mentions = mentionsByPaperId.get(p.id);
      const hasAnalysis = !!p.analysisId;

      return {
        id: p.id,
        externalId: p.externalId,
        title: p.title,
        abstract: p.abstract ? p.abstract.substring(0, 200) : null,
        publishedAt: p.publishedAt?.toISOString() || null,
        primaryCategory: p.primaryCategory,
        categories: p.categories,
        pdfUrl: p.pdfUrl,
        // V3 analysis (inline)
        analysis: hasAnalysis
          ? {
              hookSentence: p.hookSentence,
              whatKind: p.whatKind,
              timeToValue: p.timeToValue,
              impactAreaTags: p.impactAreaTags,
              practicalValueScore: p.practicalValueScore,
              practicalValueTotal: p.practicalValueTotal,
              keyNumbers: p.keyNumbers,
              readinessLevel: p.readinessLevel,
              howThisChangesThings: p.howThisChangesThings,
              whatCameBefore: p.whatCameBefore,
              status: p.analysisStatus,
            }
          : null,
        // Who's Behind This (Field 10)
        whoBehindThis: authorInfo
          ? `${authorInfo.affiliation || "Unknown institution"} \u00b7 ${authorInfo.count} author${authorInfo.count !== 1 ? "s" : ""}`
          : null,
        authorCount: authorInfo?.count || 0,
        firstAuthorAffiliation: authorInfo?.affiliation || null,
        // Social mentions
        mentionCount: mentions?.count || 0,
        totalEngagement: mentions?.totalEngagement || 0,
      };
    });

    return NextResponse.json({
      papers: enrichedPapers,
      total,
      page,
      pageSize,
      totalPages,
    });
  } catch (error) {
    console.error("Error fetching feed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch feed" },
      { status: 500 }
    );
  }
}
