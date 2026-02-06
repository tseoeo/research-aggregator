/**
 * Analysis V3 Budget & Config
 *
 * Redis-backed budget and auto-analysis config for v3 analysis.
 * Keys: analysis_v3:daily_budget_cents, analysis_v3:monthly_budget_cents,
 *        analysis_v3:auto_enabled, analysis_v3:paused
 */

import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";

function getRedis() {
  return new Redis(REDIS_URL, { maxRetriesPerRequest: 3, lazyConnect: true });
}

const KEYS = {
  dailyBudget: "analysis_v3:daily_budget_cents",
  monthlyBudget: "analysis_v3:monthly_budget_cents",
  autoEnabled: "analysis_v3:auto_enabled",
  paused: "analysis_v3:paused",
  pauseReason: "analysis_v3:pause_reason",
} as const;

const DEFAULTS = {
  dailyBudgetCents: 500, // $5.00
  monthlyBudgetCents: 15000, // $150.00
  autoEnabled: false,
  paused: false,
};

export interface AnalysisV3Config {
  dailyBudgetCents: number;
  monthlyBudgetCents: number;
  autoEnabled: boolean;
  paused: boolean;
  pauseReason: string | null;
}

export async function getAnalysisV3Config(): Promise<AnalysisV3Config> {
  const redis = getRedis();
  try {
    const [daily, monthly, auto, paused, pauseReason] = await Promise.all([
      redis.get(KEYS.dailyBudget),
      redis.get(KEYS.monthlyBudget),
      redis.get(KEYS.autoEnabled),
      redis.get(KEYS.paused),
      redis.get(KEYS.pauseReason),
    ]);

    return {
      dailyBudgetCents: daily ? parseInt(daily) : DEFAULTS.dailyBudgetCents,
      monthlyBudgetCents: monthly ? parseInt(monthly) : DEFAULTS.monthlyBudgetCents,
      autoEnabled: auto === "true",
      paused: paused === "true",
      pauseReason: pauseReason || null,
    };
  } finally {
    redis.disconnect();
  }
}

export async function setBudget(dailyCents?: number, monthlyCents?: number): Promise<void> {
  const redis = getRedis();
  try {
    if (dailyCents !== undefined) {
      await redis.set(KEYS.dailyBudget, String(dailyCents));
    }
    if (monthlyCents !== undefined) {
      await redis.set(KEYS.monthlyBudget, String(monthlyCents));
    }
  } finally {
    redis.disconnect();
  }
}

export async function setAutoAnalysis(enabled: boolean): Promise<void> {
  const redis = getRedis();
  try {
    await redis.set(KEYS.autoEnabled, String(enabled));
    if (!enabled) {
      await redis.set(KEYS.paused, "false");
      await redis.del(KEYS.pauseReason);
    }
  } finally {
    redis.disconnect();
  }
}

export async function setPaused(paused: boolean, reason?: string): Promise<void> {
  const redis = getRedis();
  try {
    await redis.set(KEYS.paused, String(paused));
    if (reason) {
      await redis.set(KEYS.pauseReason, reason);
    } else if (!paused) {
      await redis.del(KEYS.pauseReason);
    }
  } finally {
    redis.disconnect();
  }
}
