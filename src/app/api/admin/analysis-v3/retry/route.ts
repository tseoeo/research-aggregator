import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analysisBatchJobs, analysisBatches } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyAdminAuth } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) return auth.error;

  try {
    const body = await request.json();
    const { jobId, batchId } = body;

    // Single job retry
    if (jobId) {
      const job = await db
        .select()
        .from(analysisBatchJobs)
        .where(eq(analysisBatchJobs.id, jobId))
        .limit(1);

      if (job.length === 0) {
        return NextResponse.json({ error: "Job not found" }, { status: 404 });
      }

      if (job[0].status !== "failed") {
        return NextResponse.json(
          { error: "Only failed jobs can be retried" },
          { status: 400 }
        );
      }

      // Reset job status
      await db
        .update(analysisBatchJobs)
        .set({
          status: "pending",
          errorMessage: null,
          completedAt: null,
        })
        .where(eq(analysisBatchJobs.id, jobId));

      // Re-enqueue to BullMQ
      const { analysisV3Queue } = await import("@/lib/queue/queues");
      await analysisV3Queue.add(
        "analyze-v3",
        { paperId: job[0].paperId, batchId: job[0].batchId },
        {
          jobId: `v3-retry-${jobId}-${Date.now()}`,
          removeOnComplete: 100,
          removeOnFail: 200,
        }
      );

      return NextResponse.json({ message: "Job retried", jobId });
    }

    // Batch retry: retry all failed jobs in a batch
    if (batchId) {
      const failedJobs = await db
        .select()
        .from(analysisBatchJobs)
        .where(
          and(
            eq(analysisBatchJobs.batchId, batchId),
            eq(analysisBatchJobs.status, "failed")
          )
        );

      if (failedJobs.length === 0) {
        return NextResponse.json({ message: "No failed jobs to retry", retried: 0 });
      }

      // Reset all failed jobs
      await db
        .update(analysisBatchJobs)
        .set({
          status: "pending",
          errorMessage: null,
          completedAt: null,
        })
        .where(
          and(
            eq(analysisBatchJobs.batchId, batchId),
            eq(analysisBatchJobs.status, "failed")
          )
        );

      // Update batch status back to running
      await db
        .update(analysisBatches)
        .set({ status: "running", finishedAt: null })
        .where(eq(analysisBatches.id, batchId));

      // Re-enqueue all
      const { analysisV3Queue } = await import("@/lib/queue/queues");
      for (const job of failedJobs) {
        await analysisV3Queue.add(
          "analyze-v3",
          { paperId: job.paperId, batchId },
          {
            jobId: `v3-retry-${job.id}-${Date.now()}`,
            removeOnComplete: 100,
            removeOnFail: 200,
          }
        );
      }

      return NextResponse.json({
        message: `Retried ${failedJobs.length} failed jobs`,
        retried: failedJobs.length,
        batchId,
      });
    }

    return NextResponse.json(
      { error: "Provide jobId or batchId" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[AnalysisV3 Retry] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Retry failed" },
      { status: 500 }
    );
  }
}
