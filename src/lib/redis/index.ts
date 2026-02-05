/**
 * Redis Connection
 *
 * Shared Redis connection configuration for BullMQ.
 */

// Parse Redis URL or use defaults
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

// Parse the URL into connection options
function parseRedisUrl(url: string) {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "localhost",
      port: parseInt(parsed.port || "6379"),
      password: parsed.password || undefined,
      maxRetriesPerRequest: null as null, // Required for BullMQ
    };
  } catch {
    // Fallback for simple host:port format
    return {
      host: "localhost",
      port: 6379,
      maxRetriesPerRequest: null as null,
    };
  }
}

// Export connection options for BullMQ (queues and workers)
export const redisConnection = parseRedisUrl(redisUrl);

// Lazy-loaded Redis client for non-BullMQ uses (caching, etc.)
let redisClient: import("ioredis").default | null = null;

export async function getRedisClient() {
  if (!redisClient) {
    const IORedis = (await import("ioredis")).default;
    redisClient = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy(times) {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    redisClient.on("error", (err) => {
      console.error("Redis connection error:", err.message);
    });
  }
  return redisClient;
}

/**
 * Check if Redis is connected
 */
export async function isRedisConnected(): Promise<boolean> {
  try {
    const client = await getRedisClient();
    const result = await client.ping();
    return result === "PONG";
  } catch {
    return false;
  }
}

/**
 * Acquire a distributed lock for multi-replica safety (Phase E)
 *
 * @param lockKey - Unique key for the lock
 * @param ttlSeconds - Time-to-live for the lock in seconds (default: 300 = 5 minutes)
 * @returns true if lock acquired, false if already held by another process
 */
export async function acquireLock(
  lockKey: string,
  ttlSeconds: number = 300
): Promise<boolean> {
  try {
    const client = await getRedisClient();
    // SET with NX (only if not exists) and EX (expire time)
    const result = await client.set(lockKey, Date.now().toString(), "EX", ttlSeconds, "NX");
    return result === "OK";
  } catch (error) {
    console.error(`[Redis] Failed to acquire lock ${lockKey}:`, error);
    return false;
  }
}

/**
 * Release a distributed lock
 *
 * @param lockKey - The lock key to release
 */
export async function releaseLock(lockKey: string): Promise<void> {
  try {
    const client = await getRedisClient();
    await client.del(lockKey);
  } catch (error) {
    console.error(`[Redis] Failed to release lock ${lockKey}:`, error);
  }
}
