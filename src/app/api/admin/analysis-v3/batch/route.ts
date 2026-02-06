import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers, paperAnalysesV3, analysisBatches, analysisBatchJobs } from "@/lib/db/schema";
import { sql, eq, notInArray } from "drizzle-orm";
import { verifyAdminAuth } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) return auth.error;

  try {
    const body = await request.json();
    const size = Math.min(10000, Math.max(1, body.size || 10));
    const model = process.env.OPENROUTER_MODEL || "moonshotai/kimi-k2.5";

    // Check for already-running batch
    const running = await db
      .select({ id: analysisBatches.id })
      .from(analysisBatches)
      .where(eq(analysisBatches.status, "running"))
      .limit(1);

    if (running.length > 0) {
      return NextResponse.json(
        { error: "A batch is already running", batchId: running[0].id },
        { status: 409 }
      );
    }

    // Find papers without v3 analysis
    const analyzedPaperIds = db
      .select({ paperId: paperAnalysesV3.paperId })
      .from(paperAnalysesV3);

    const unanalyzed = await db
      .select({ id: papers.id })
      .from(papers)
      .where(notInArray(papers.id, analyzedPaperIds))
      .orderBy(sql`${papers.publishedAt} DESC NULLS LAST`)
      .limit(size);

    if (unanalyzed.length === 0) {
      return NextResponse.json({ message: "No papers need analysis", batchSize: 0 });
    }

    // Create batch
    const batch = await db
      .insert(analysisBatches)
      .values({
        batchSize: unanalyzed.length,
        model,
        status: "running",
        scope: body.scope || "newest",
      })
      .returning();

    const batchId = batch[0].id;

    // Create individual job records
    const jobValues = unanalyzed.map((p) => ({
      batchId,
      paperId: p.id,
      status: "pending" as const,
    }));

    await db.insert(analysisBatchJobs).values(jobValues);

    // Enqueue jobs to BullMQ analysis-v3 queue
    const { analysisV3Queue } = await import("@/lib/queue/queues");
    for (const p of unanalyzed) {
      await analysisV3Queue.add(
        "analyze-v3",
        { paperId: p.id, batchId },
        {
          jobId: `v3-batch-${batchId}-${p.id}`,
          removeOnComplete: 100,
          removeOnFail: 200,
        }
      );
    }

    return NextResponse.json({
      batchId,
      batchSize: unanalyzed.length,
      model,
      status: "running",
    });
  } catch (error) {
    console.error("[AnalysisV3 Batch] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start batch" },
      { status: 500 }
    );
  }
}
