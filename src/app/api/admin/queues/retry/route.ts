import { NextRequest, NextResponse } from "next/server";
import { queues } from "@/lib/queue/queues";
import { verifyAdminAuth } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/queues/retry
 *
 * Retry a failed job by queue name and job ID.
 *
 * Authentication: Authorization: Bearer <ADMIN_SECRET>
 * Body: { queue: string, jobId: string }
 */
export async function POST(request: NextRequest) {
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) {
    return auth.error;
  }

  try {
    const body = await request.json();
    const { queue: queueName, jobId } = body;

    if (!queueName || !jobId) {
      return NextResponse.json(
        { error: "Both 'queue' and 'jobId' are required" },
        { status: 400 }
      );
    }

    const queue = (queues as Record<string, typeof queues[keyof typeof queues]>)[queueName];
    if (!queue) {
      return NextResponse.json(
        { error: `Queue '${queueName}' not found` },
        { status: 404 }
      );
    }

    const job = await queue.getJob(jobId);
    if (!job) {
      return NextResponse.json(
        { error: `Job '${jobId}' not found in queue '${queueName}'` },
        { status: 404 }
      );
    }

    const state = await job.getState();
    if (state !== "failed") {
      return NextResponse.json(
        { error: `Job is in '${state}' state, not 'failed'. Only failed jobs can be retried.` },
        { status: 400 }
      );
    }

    await job.retry(state);

    return NextResponse.json({
      success: true,
      queue: queueName,
      jobId,
      message: `Job ${jobId} has been retried`,
    });
  } catch (error) {
    console.error("[QueueRetry] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to retry job" },
      { status: 500 }
    );
  }
}
