/**
 * Trigger V3 Analysis API
 *
 * Triggers the v3 paper analysis pipeline for papers.
 *
 * Authentication: Authorization: Bearer <ADMIN_SECRET>
 *
 * POST body:
 *   - paperId?: string — analyze a single paper
 *   - category?: string — filter by arXiv category (e.g., "cs.AI")
 *   - limit?: number — max papers to analyze (default 20, max 200)
 *   - model?: string — optional model override
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, paperAnalysesV3 } from "@/lib/db/schema";
import { eq, isNull, desc, sql, and } from "drizzle-orm";
import { analysisV3Queue } from "@/lib/queue/queues";
import { verifyAdminAuth } from "@/lib/auth/admin";
import { isAiEnabledAsync, getAiStatusAsync, getAiStatusMessage } from "@/lib/ai/config";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) {
    return auth.error;
  }

  // Check if AI is enabled
  if (!(await isAiEnabledAsync(true))) {
    const status = await getAiStatusAsync();
    return NextResponse.json(
      {
        error: "AI processing is not available",
        message: getAiStatusMessage(status),
        hint: "Enable AI from the admin panel or set AI_ENABLED=true",
      },
      { status: 503 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const { paperId, category, model } = body;
    const limit = Math.min(body.limit || 20, 200);

    // Single paper mode
    if (paperId) {
      const paper = await db
        .select({
          id: papers.id,
          title: papers.title,
          abstract: papers.abstract,
          publishedAt: papers.publishedAt,
          categories: papers.categories,
        })
        .from(papers)
        .where(eq(papers.id, paperId))
        .limit(1);

      if (paper.length === 0) {
        return NextResponse.json({ error: "Paper not found" }, { status: 404 });
      }

      const p = paper[0];
      if (!p.abstract) {
        return NextResponse.json({ error: "Paper has no abstract" }, { status: 400 });
      }

      await analysisV3Queue.add(
        "analyze-v3",
        {
          paperId: p.id,
          title: p.title,
          abstract: p.abstract,
          publishedDate: p.publishedAt?.toISOString().split("T")[0],
          categories: p.categories || [],
          force: !!body.force,
          ...(model && { model }),
        }
      );

      return NextResponse.json({
        message: "V3 analysis triggered for single paper",
        paperId: p.id,
        title: p.title,
      });
    }

    // Batch mode — find papers without v3 analysis
    const conditions = [isNull(paperAnalysesV3.id)];

    if (category) {
      conditions.push(sql`${papers.categories} @> ARRAY[${category}]::text[]`);
    }

    const papersToAnalyze = await db
      .select({
        id: papers.id,
        title: papers.title,
        abstract: papers.abstract,
        publishedAt: papers.publishedAt,
        categories: papers.categories,
      })
      .from(papers)
      .leftJoin(paperAnalysesV3, eq(papers.id, paperAnalysesV3.paperId))
      .where(and(...conditions))
      .orderBy(desc(papers.publishedAt))
      .limit(limit);

    let queued = 0;
    for (let i = 0; i < papersToAnalyze.length; i++) {
      const p = papersToAnalyze[i];
      if (!p.abstract) continue;

      await analysisV3Queue.add(
        "analyze-v3",
        {
          paperId: p.id,
          title: p.title,
          abstract: p.abstract,
          publishedDate: p.publishedAt?.toISOString().split("T")[0],
          categories: p.categories || [],
          ...(model && { model }),
        },
        { delay: i * 15000 } // 15s between jobs
      );
      queued++;
    }

    console.log(`[Admin] Triggered v3 analysis for ${queued} papers${category ? ` in ${category}` : ""}`);

    return NextResponse.json({
      message: "V3 analysis triggered",
      queued,
      category: category || "all",
      estimatedMinutes: Math.ceil((queued * 15) / 60),
      ...(model && { model }),
    });
  } catch (error) {
    console.error("[Admin] Error triggering v3 analysis:", error);
    return NextResponse.json(
      { error: "Failed to trigger v3 analysis" },
      { status: 500 }
    );
  }
}

/**
 * GET — check how many papers need v3 analysis
 */
export async function GET(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) {
    return auth.error;
  }

  try {
    const withoutV3 = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(papers)
      .leftJoin(paperAnalysesV3, eq(papers.id, paperAnalysesV3.paperId))
      .where(isNull(paperAnalysesV3.id));

    const withV3 = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(paperAnalysesV3);

    return NextResponse.json({
      papersWithoutV3Analysis: withoutV3[0]?.count || 0,
      papersWithV3Analysis: withV3[0]?.count || 0,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to count papers" },
      { status: 500 }
    );
  }
}
