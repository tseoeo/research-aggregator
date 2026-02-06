import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analysisBatches, analysisBatchJobs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { verifyAdminAuth } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) return auth.error;

  try {
    const running = await db
      .select()
      .from(analysisBatches)
      .where(eq(analysisBatches.status, "running"))
      .limit(1);

    const paused = running.length === 0
      ? await db.select().from(analysisBatches).where(eq(analysisBatches.status, "paused")).limit(1)
      : [];

    const batch = running[0] || paused[0];
    if (!batch) {
      return NextResponse.json({ message: "No active batch to cancel" });
    }

    // Mark pending jobs as cancelled
    await db
      .update(analysisBatchJobs)
      .set({ status: "failed", errorMessage: "Batch cancelled", completedAt: new Date() })
      .where(and(
        eq(analysisBatchJobs.batchId, batch.id),
        eq(analysisBatchJobs.status, "pending")
      ));

    // Mark batch as cancelled
    await db
      .update(analysisBatches)
      .set({ status: "cancelled", finishedAt: new Date() })
      .where(eq(analysisBatches.id, batch.id));

    // Drain the queue
    const { analysisV3Queue } = await import("@/lib/queue/queues");
    await analysisV3Queue.drain();

    return NextResponse.json({ message: "Batch cancelled", batchId: batch.id });
  } catch (error) {
    console.error("[AnalysisV3 Cancel] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel" },
      { status: 500 }
    );
  }
}
