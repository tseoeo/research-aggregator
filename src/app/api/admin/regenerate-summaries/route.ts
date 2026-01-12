import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers } from "@/lib/db/schema";
import { summaryQueue } from "@/lib/queue/queues";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/regenerate-summaries
 *
 * Clear all existing summaries and queue regeneration jobs.
 * Protected by a simple secret key.
 */
export async function POST(request: NextRequest) {
  try {
    // Simple protection - check for admin secret
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get("secret");
    const adminSecret = process.env.ADMIN_SECRET || "admin-secret-change-me";

    if (secret !== adminSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all papers
    const allPapers = await db
      .select({
        id: papers.id,
        externalId: papers.externalId,
        title: papers.title,
        abstract: papers.abstract,
      })
      .from(papers);

    console.log(`[RegenerateSummaries] Found ${allPapers.length} papers`);

    // Clear existing summaries
    await db
      .update(papers)
      .set({
        summaryBullets: null,
        summaryEli5: null,
        summaryGeneratedAt: null,
        summaryModel: null,
      })
      .where(sql`1=1`);

    console.log(`[RegenerateSummaries] Cleared existing summaries`);

    // Queue summary generation for each paper
    let queued = 0;
    for (let i = 0; i < allPapers.length; i++) {
      const paper = allPapers[i];

      if (!paper.abstract) {
        console.log(`[RegenerateSummaries] Skipping ${paper.externalId} - no abstract`);
        continue;
      }

      await summaryQueue.add(
        "regenerate-summary",
        {
          paperId: paper.id,
          arxivId: paper.externalId,
          title: paper.title,
          abstract: paper.abstract,
        },
        { delay: i * 2000 } // 2 seconds between each to respect rate limits
      );

      queued++;
    }

    console.log(`[RegenerateSummaries] Queued ${queued} summary jobs`);

    return NextResponse.json({
      success: true,
      totalPapers: allPapers.length,
      queuedJobs: queued,
      message: `Queued ${queued} papers for summary regeneration with GPT-5.1`,
    });
  } catch (error) {
    console.error("Error regenerating summaries:", error);
    return NextResponse.json(
      { error: "Failed to regenerate summaries" },
      { status: 500 }
    );
  }
}
