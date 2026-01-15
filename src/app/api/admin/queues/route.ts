/**
 * Queue Status API
 *
 * Provides status of all job queues for monitoring.
 * Should be protected in production.
 */

import { NextRequest, NextResponse } from "next/server";
import { queues } from "@/lib/queue/queues";

export const dynamic = "force-dynamic";

interface FailedJobInfo {
  id: string;
  name: string;
  failedReason: string;
  attemptsMade: number;
  timestamp: number;
  data: Record<string, unknown>;
}

interface QueueStatus {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  failedJobs?: FailedJobInfo[];
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const includeFailedDetails = searchParams.get("failed") === "true";
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 50);

    const queueStatuses: QueueStatus[] = await Promise.all(
      Object.entries(queues).map(async ([name, queue]) => {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
        ]);

        const status: QueueStatus = {
          name,
          waiting,
          active,
          completed,
          failed,
          delayed,
          paused: await queue.isPaused(),
        };

        // Optionally include failed job details
        if (includeFailedDetails && failed > 0) {
          const failedJobs = await queue.getFailed(0, limit - 1);
          status.failedJobs = failedJobs.map((job) => ({
            id: job.id || "unknown",
            name: job.name,
            failedReason: job.failedReason || "Unknown error",
            attemptsMade: job.attemptsMade,
            timestamp: job.timestamp,
            data: job.data as Record<string, unknown>,
          }));
        }

        return status;
      })
    );

    return NextResponse.json({
      status: "ok",
      timestamp: new Date().toISOString(),
      queues: queueStatuses,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Failed to get queue status",
      },
      { status: 500 }
    );
  }
}
