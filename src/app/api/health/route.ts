/**
 * Health Check API
 *
 * Provides health status for monitoring and Railway deployments.
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { papers } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  checks: {
    database: {
      status: "up" | "down";
      latencyMs?: number;
      error?: string;
    };
    redis?: {
      status: "up" | "down";
      error?: string;
    };
  };
  stats?: {
    totalPapers: number;
  };
}

export async function GET() {
  const startTime = Date.now();
  const health: HealthStatus = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "0.1.0",
    checks: {
      database: { status: "down" },
    },
  };

  // Check database
  try {
    const dbStart = Date.now();
    const result = await db.select({ count: sql<number>`count(*)` }).from(papers);
    health.checks.database = {
      status: "up",
      latencyMs: Date.now() - dbStart,
    };
    health.stats = {
      totalPapers: Number(result[0]?.count || 0),
    };
  } catch (error) {
    health.checks.database = {
      status: "down",
      error: error instanceof Error ? error.message : "Unknown error",
    };
    health.status = "unhealthy";
  }

  // Check Redis (optional, only if configured)
  if (process.env.REDIS_URL) {
    try {
      const { isRedisConnected } = await import("@/lib/redis");
      const connected = await isRedisConnected();
      health.checks.redis = { status: connected ? "up" : "down" };
      if (!connected) {
        health.status = "degraded";
      }
    } catch (error) {
      health.checks.redis = {
        status: "down",
        error: error instanceof Error ? error.message : "Unknown error",
      };
      health.status = "degraded";
    }
  }

  const statusCode = health.status === "healthy" ? 200 : health.status === "degraded" ? 200 : 503;

  return NextResponse.json(health, { status: statusCode });
}
