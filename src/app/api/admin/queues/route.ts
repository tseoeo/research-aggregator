/**
 * Queue Status API
 *
 * Provides status of all job queues for monitoring.
 * Should be protected in production.
 */

import { NextResponse } from "next/server";
import { queues } from "@/lib/queue/queues";

export const dynamic = "force-dynamic";

interface QueueStatus {
  name: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}

export async function GET() {
  try {
    const queueStatuses: QueueStatus[] = await Promise.all(
      Object.entries(queues).map(async ([name, queue]) => {
        const [waiting, active, completed, failed, delayed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getCompletedCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
        ]);

        return {
          name,
          waiting,
          active,
          completed,
          failed,
          delayed,
          paused: await queue.isPaused(),
        };
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
