/**
 * Backfill Papers API
 *
 * Queues historical paper fetching for a date range.
 * Each date is processed as a separate job to respect rate limits.
 *
 * Authentication: Authorization: Bearer <ADMIN_SECRET>
 *
 * Body: {
 *   "startDate": "2024-01-01",
 *   "endDate": "2024-01-31",      // Optional, defaults to yesterday
 *   "categories": ["cs.AI"],       // Optional, defaults to all AI categories
 *   "delayBetweenDays": 60000      // Optional, ms between date jobs (default 60s)
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { backfillQueue } from "@/lib/queue/queues";
import { verifyAdminAuth } from "@/lib/auth/admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Verify admin auth via Authorization header
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) {
    return auth.error;
  }

  try {
    const body = await request.json().catch(() => ({}));

    // Validate start date
    if (!body.startDate) {
      return NextResponse.json(
        { error: "startDate is required (format: YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const startDate = new Date(body.startDate);
    if (isNaN(startDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid startDate format (use YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    // End date defaults to yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const endDate = body.endDate ? new Date(body.endDate) : yesterday;

    if (isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid endDate format (use YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    // Validate date range
    if (startDate > endDate) {
      return NextResponse.json(
        { error: "startDate must be before endDate" },
        { status: 400 }
      );
    }

    // Calculate number of days
    const msPerDay = 24 * 60 * 60 * 1000;
    const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / msPerDay) + 1;

    // Limit to 90 days per request to avoid overwhelming the queue
    if (daysDiff > 90) {
      return NextResponse.json(
        { error: `Date range too large: ${daysDiff} days. Maximum is 90 days per request.` },
        { status: 400 }
      );
    }

    const delayBetweenDays = body.delayBetweenDays || 60000; // Default 60 seconds between days
    const categories = body.categories; // Optional, worker defaults to all AI categories

    // Queue a job for each day
    const queuedDates: string[] = [];
    for (let i = 0; i < daysDiff; i++) {
      const targetDate = new Date(startDate);
      targetDate.setDate(targetDate.getDate() + i);
      const dateStr = targetDate.toISOString().split("T")[0];

      await backfillQueue.add(
        `backfill-${dateStr}`,
        {
          date: dateStr,
          ...(categories && { categories }),
        },
        { delay: i * delayBetweenDays }
      );

      queuedDates.push(dateStr);
    }

    console.log(`[Admin] Queued backfill for ${daysDiff} days: ${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}`);

    return NextResponse.json({
      message: `Queued backfill for ${daysDiff} days`,
      startDate: startDate.toISOString().split("T")[0],
      endDate: endDate.toISOString().split("T")[0],
      daysQueued: daysDiff,
      delayBetweenDays,
      estimatedMinutes: Math.ceil((daysDiff * delayBetweenDays) / 60000),
      ...(categories && { categories }),
      dates: queuedDates,
    });
  } catch (error) {
    console.error("[Admin] Error queueing backfill:", error);
    return NextResponse.json(
      { error: "Failed to queue backfill" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/backfill-papers
 *
 * Check backfill queue status.
 *
 * Authentication: Authorization: Bearer <ADMIN_SECRET>
 */
export async function GET(request: NextRequest) {
  // Verify admin auth via Authorization header
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) {
    return auth.error;
  }

  try {
    const waiting = await backfillQueue.getWaitingCount();
    const active = await backfillQueue.getActiveCount();
    const completed = await backfillQueue.getCompletedCount();
    const failed = await backfillQueue.getFailedCount();
    const delayed = await backfillQueue.getDelayedCount();

    // Get recent jobs for visibility
    const recentCompleted = await backfillQueue.getCompleted(0, 5);
    const recentFailed = await backfillQueue.getFailed(0, 5);

    return NextResponse.json({
      queue: "arxiv-backfill",
      counts: {
        waiting,
        active,
        delayed,
        completed,
        failed,
      },
      recentCompleted: recentCompleted.map((job) => ({
        id: job.id,
        date: job.data.date,
        result: job.returnvalue,
      })),
      recentFailed: recentFailed.map((job) => ({
        id: job.id,
        date: job.data.date,
        error: job.failedReason,
      })),
    });
  } catch (error) {
    console.error("[Admin] Error checking backfill queue:", error);
    return NextResponse.json(
      { error: "Failed to check backfill queue" },
      { status: 500 }
    );
  }
}
