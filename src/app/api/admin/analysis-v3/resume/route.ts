import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analysisBatches } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { verifyAdminAuth } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) return auth.error;

  try {
    const updated = await db
      .update(analysisBatches)
      .set({ status: "running" })
      .where(eq(analysisBatches.status, "paused"))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ message: "No paused batch to resume" });
    }

    // Resume the BullMQ queue
    const { analysisV3Queue } = await import("@/lib/queue/queues");
    await analysisV3Queue.resume();

    return NextResponse.json({ message: "Batch resumed", batchId: updated[0].id });
  } catch (error) {
    console.error("[AnalysisV3 Resume] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to resume" },
      { status: 500 }
    );
  }
}
