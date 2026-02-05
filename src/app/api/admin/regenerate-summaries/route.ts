import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers } from "@/lib/db/schema";
import { summaryQueue } from "@/lib/queue/queues";
import { sql } from "drizzle-orm";
import { verifyAdminAuth } from "@/lib/auth/admin";
import { isAiEnabled, getAiStatusMessage } from "@/lib/ai/config";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/regenerate-summaries
 *
 * Clear all existing summaries and queue regeneration jobs.
 *
 * Authentication: Authorization: Bearer <ADMIN_SECRET>
 */
export async function POST(request: NextRequest) {
  // Verify admin auth via Authorization header
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) {
    return auth.error;
  }

  // Check if AI is enabled
  if (!isAiEnabled()) {
    return NextResponse.json(
      {
        error: "AI processing is not available",
        message: getAiStatusMessage(),
        hint: "Set AI_ENABLED=true and configure OPENROUTER_API_KEY to enable AI features"
      },
      { status: 503 }
    );
  }

  try {

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
