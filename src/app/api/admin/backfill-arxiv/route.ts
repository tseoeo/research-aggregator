/**
 * Admin Backfill arXiv API (Phase 3)
 *
 * Allows admins to trigger historical backfill of papers for a date range.
 * Uses date-based fetching to ensure 100% capture.
 *
 * Authentication: Authorization: Bearer <ADMIN_SECRET>
 *
 * POST /api/admin/backfill-arxiv
 * Body: { startDate: "2026-01-01", endDate: "2026-02-04", categories?: string[] }
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/auth/admin";
import { arxivFetchQueue } from "@/lib/queue/queues";
import { AI_CATEGORIES } from "@/lib/services/arxiv";

export const dynamic = "force-dynamic";

interface BackfillRequest {
  startDate: string; // ISO date "YYYY-MM-DD"
  endDate: string; // ISO date "YYYY-MM-DD"
  categories?: string[]; // Optional - defaults to AI_CATEGORIES
  delayBetweenDays?: number; // Optional - delay in ms between jobs (default: 60000 = 1 min)
}

/**
 * Generate deterministic job ID for date-based fetch (Phase F)
 */
function getDateFetchJobId(date: string): string {
  // BullMQ doesn't allow colons in job IDs
  return `arxiv-fetch-date-${date}`;
}

/**
 * Validate ISO date string
 */
function isValidDateString(dateStr: string): boolean {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;

  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

/**
 * Get all dates between start and end (inclusive)
 */
function getDateRange(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(startDate);
  const end = new Date(endDate);

  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

export async function POST(request: NextRequest) {
  // Verify admin auth
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) {
    return auth.error;
  }

  try {
    const body: BackfillRequest = await request.json();
    const {
      startDate,
      endDate,
      categories = [...AI_CATEGORIES],
      delayBetweenDays = 60000, // Default: 1 minute between dates
    } = body;

    // Validate required fields
    if (!startDate || !endDate) {
      return NextResponse.json(
        { error: "startDate and endDate are required" },
        { status: 400 }
      );
    }

    // Validate date formats
    if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    // Validate date range
    if (new Date(startDate) > new Date(endDate)) {
      return NextResponse.json(
        { error: "startDate must be before or equal to endDate" },
        { status: 400 }
      );
    }

    // Validate categories
    const validCategories = categories.filter((c) =>
      AI_CATEGORIES.includes(c as typeof AI_CATEGORIES[number])
    );
    if (validCategories.length === 0) {
      return NextResponse.json(
        { error: `Invalid categories. Valid options: ${AI_CATEGORIES.join(", ")}` },
        { status: 400 }
      );
    }

    // Get all dates in range
    const dates = getDateRange(startDate, endDate);

    // Safety limit: max 60 days per request
    if (dates.length > 60) {
      return NextResponse.json(
        { error: `Too many dates (${dates.length}). Maximum 60 days per request.` },
        { status: 400 }
      );
    }

    // Queue jobs for each date with staggered delays (Phase F: Idempotent job IDs)
    const queuedJobs: { date: string; jobId: string; delay: number }[] = [];

    for (let i = 0; i < dates.length; i++) {
      const date = dates[i];
      const jobId = getDateFetchJobId(date);
      const delay = i * delayBetweenDays;

      await arxivFetchQueue.add(
        "fetch-by-date",
        {
          date,
          categories: validCategories,
        },
        {
          delay,
          jobId, // Phase F: Deterministic job ID prevents duplicates
        }
      );

      queuedJobs.push({ date, jobId, delay });
    }

    const estimatedMinutes = Math.ceil(
      (dates.length * delayBetweenDays) / 60000
    );

    return NextResponse.json({
      status: "ok",
      message: `Queued ${queuedJobs.length} backfill jobs`,
      startDate,
      endDate,
      categories: validCategories,
      totalDays: dates.length,
      delayBetweenDays,
      estimatedCompletionMinutes: estimatedMinutes,
      jobs: queuedJobs.slice(0, 10), // Only show first 10 for brevity
      moreJobs: queuedJobs.length > 10 ? queuedJobs.length - 10 : 0,
    });
  } catch (error) {
    console.error("[BackfillArxiv] Error:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Failed to queue backfill jobs",
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to check backfill status
 */
export async function GET(request: NextRequest) {
  // Verify admin auth
  const auth = verifyAdminAuth(request);
  if (!auth.authorized) {
    return auth.error;
  }

  try {
    // Get queue stats
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      arxivFetchQueue.getWaitingCount(),
      arxivFetchQueue.getActiveCount(),
      arxivFetchQueue.getCompletedCount(),
      arxivFetchQueue.getFailedCount(),
      arxivFetchQueue.getDelayedCount(),
    ]);

    // Get recent jobs
    const recentJobs = await arxivFetchQueue.getJobs(
      ["completed", "failed", "active", "waiting", "delayed"],
      0,
      20
    );

    const jobSummary = recentJobs.map((job) => ({
      id: job.id,
      name: job.name,
      data: job.data,
      state: job.finishedOn ? "completed" : job.failedReason ? "failed" : "pending",
      processedOn: job.processedOn,
      finishedOn: job.finishedOn,
      failedReason: job.failedReason,
    }));

    return NextResponse.json({
      status: "ok",
      queue: {
        name: "arxiv-fetch",
        waiting,
        active,
        completed,
        failed,
        delayed,
      },
      recentJobs: jobSummary,
    });
  } catch (error) {
    console.error("[BackfillArxiv] Error getting status:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Failed to get backfill status",
      },
      { status: 500 }
    );
  }
}
