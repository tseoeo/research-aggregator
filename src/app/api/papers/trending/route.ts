import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, socialMentions, paperAuthors, authors } from "@/lib/db/schema";
import { eq, sql, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/papers/trending
 *
 * Fetch papers ordered by total social mentions (likes + reposts + replies).
 * Returns papers from the database that have been mentioned on social platforms.
 */
export async function GET() {
  try {
    // Query papers with aggregated social mention counts
    const trendingPapers = await db
      .select({
        id: papers.id,
        externalId: papers.externalId,
        title: papers.title,
        abstract: papers.abstract,
        publishedAt: papers.publishedAt,
        primaryCategory: papers.primaryCategory,
        pdfUrl: papers.pdfUrl,
        summaryBullets: papers.summaryBullets,
        totalMentions: sql<number>`COALESCE(COUNT(${socialMentions.id}), 0)`,
        totalEngagement: sql<number>`COALESCE(SUM(${socialMentions.likes} + ${socialMentions.reposts} + ${socialMentions.replies}), 0)`,
      })
      .from(papers)
      .leftJoin(socialMentions, eq(papers.id, socialMentions.paperId))
      .groupBy(papers.id)
      .having(sql`COUNT(${socialMentions.id}) > 0`)
      .orderBy(desc(sql`SUM(${socialMentions.likes} + ${socialMentions.reposts} + ${socialMentions.replies})`))
      .limit(50);

    // Get authors for each paper
    const papersWithAuthors = await Promise.all(
      trendingPapers.map(async (paper) => {
        const paperAuthorsData = await db
          .select({
            name: authors.name,
            id: authors.id,
          })
          .from(paperAuthors)
          .innerJoin(authors, eq(paperAuthors.authorId, authors.id))
          .where(eq(paperAuthors.paperId, paper.id))
          .orderBy(paperAuthors.position);

        return {
          ...paper,
          publishedAt: paper.publishedAt?.toISOString() || null,
          mentionCount: Number(paper.totalMentions),
          authors: paperAuthorsData,
        };
      })
    );

    return NextResponse.json({
      papers: papersWithAuthors,
      total: papersWithAuthors.length,
    });
  } catch (error) {
    console.error("Error fetching trending papers:", error);
    return NextResponse.json(
      { error: "Failed to fetch trending papers", papers: [] },
      { status: 500 }
    );
  }
}
