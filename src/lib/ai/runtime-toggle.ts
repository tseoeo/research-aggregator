/**
 * Runtime AI Toggle (Redis-backed)
 *
 * Provides a runtime-controllable AI enabled/disabled flag stored in Redis.
 * Both the web service and worker process read from the same Redis instance.
 *
 * Resolution order:
 *   1. Redis key `config:ai_enabled` (runtime override)
 *   2. `process.env.AI_ENABLED` (env var fallback)
 *
 * Also stores `config:ai_enabled_updated_at` for audit.
 * Publishes changes to `config:updates` Pub/Sub channel for worker reactivity.
 */

import { getRedisClient } from "../redis";

const REDIS_KEY = "config:ai_enabled";
const REDIS_KEY_UPDATED_AT = "config:ai_enabled_updated_at";
const PUBSUB_CHANNEL = "config:updates";

// In-memory cache for web API routes (avoids hitting Redis on every request)
let cachedValue: boolean | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 5_000; // 5 seconds for UI routes

/**
 * Read the runtime AI toggle from Redis (with in-memory cache).
 * Falls back to process.env.AI_ENABLED if Redis key is not set.
 */
export async function getAiEnabledRuntime(skipCache = false): Promise<boolean> {
  // Check in-memory cache (unless caller wants fresh value)
  if (!skipCache && cachedValue !== null && Date.now() - cachedAt < CACHE_TTL_MS) {
    return cachedValue;
  }

  try {
    const client = await getRedisClient();
    const value = await client.get(REDIS_KEY);

    if (value !== null) {
      const enabled = value === "true";
      cachedValue = enabled;
      cachedAt = Date.now();
      return enabled;
    }
  } catch (error) {
    console.error("[RuntimeToggle] Redis read failed, falling back to env:", error);
  }

  // Fallback to env var
  const envValue = process.env.AI_ENABLED === "true";
  cachedValue = envValue;
  cachedAt = Date.now();
  return envValue;
}

/**
 * Get metadata about the current toggle state.
 */
export async function getAiToggleInfo(): Promise<{
  enabled: boolean;
  source: "redis" | "env";
  updatedAt: string | null;
}> {
  try {
    const client = await getRedisClient();
    const [value, updatedAt] = await Promise.all([
      client.get(REDIS_KEY),
      client.get(REDIS_KEY_UPDATED_AT),
    ]);

    if (value !== null) {
      return {
        enabled: value === "true",
        source: "redis",
        updatedAt,
      };
    }
  } catch (error) {
    console.error("[RuntimeToggle] Redis read failed:", error);
  }

  return {
    enabled: process.env.AI_ENABLED === "true",
    source: "env",
    updatedAt: null,
  };
}

/**
 * Set the runtime AI toggle. Writes to Redis and publishes update via Pub/Sub.
 */
export async function setAiEnabledRuntime(enabled: boolean): Promise<void> {
  const client = await getRedisClient();
  const now = new Date().toISOString();

  await Promise.all([
    client.set(REDIS_KEY, enabled ? "true" : "false"),
    client.set(REDIS_KEY_UPDATED_AT, now),
  ]);

  // Invalidate local cache immediately
  cachedValue = enabled;
  cachedAt = Date.now();

  // Publish to Pub/Sub so workers react immediately
  await client.publish(
    PUBSUB_CHANNEL,
    JSON.stringify({ key: "ai_enabled", value: enabled, updatedAt: now })
  );

  console.log(`[RuntimeToggle] AI ${enabled ? "ENABLED" : "DISABLED"} at ${now}`);
}

/**
 * Subscribe to config updates via Redis Pub/Sub.
 * IMPORTANT: Requires a dedicated Redis client (not the shared one).
 * Once a client calls `subscribe()`, it can only be used for Pub/Sub.
 */
export async function subscribeToConfigUpdates(
  callback: (data: { key: string; value: boolean; updatedAt: string }) => void
): Promise<void> {
  // Create a dedicated subscriber client
  const IORedis = (await import("ioredis")).default;
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  const subscriber = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      return Math.min(times * 50, 2000);
    },
  });

  subscriber.on("error", (err) => {
    console.error("[RuntimeToggle] Subscriber error:", err.message);
  });

  await subscriber.subscribe(PUBSUB_CHANNEL);

  subscriber.on("message", (_channel, message) => {
    try {
      const data = JSON.parse(message);
      // Invalidate local cache on any update
      cachedValue = null;
      cachedAt = 0;
      callback(data);
    } catch (error) {
      console.error("[RuntimeToggle] Failed to parse Pub/Sub message:", error);
    }
  });

  console.log("[RuntimeToggle] Subscribed to config updates");
}
