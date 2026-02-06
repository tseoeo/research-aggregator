import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { analysisBatches } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { verifyAdminAuth } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) return auth.error;

  try {
    const limit = Math.min(50, parseInt(request.nextUrl.searchParams.get("limit") || "20"));
    const offset = parseInt(request.nextUrl.searchParams.get("offset") || "0");

    const batches = await db
      .select()
      .from(analysisBatches)
      .orderBy(desc(analysisBatches.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      batches: batches.map((b) => ({
        id: b.id,
        batchSize: b.batchSize,
        completed: b.completed,
        failed: b.failed,
        totalCostCents: b.totalCostCents,
        avgCostCents: b.completed > 0 ? Math.round(b.totalCostCents / b.completed) : 0,
        model: b.model,
        status: b.status,
        startedAt: b.startedAt?.toISOString() || null,
        finishedAt: b.finishedAt?.toISOString() || null,
      })),
    });
  } catch (error) {
    console.error("[AnalysisV3 History] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get history" },
      { status: 500 }
    );
  }
}
