import { Redis } from "ioredis";
import { env } from "./env";
import { logger } from "./logger";

// One shared connection for caching and rate limiting.
//
// Redis is a REQUIRED dependency at startup (connectRedis() throws, the process exits,
// Docker/Kubernetes restart it) but an OPTIONAL one at runtime: if it goes down later,
// callers fall back (cache -> read MongoDB, rate limiter -> let requests through) and
// the API keeps serving, just slower.
export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true, // connect explicitly in connectRedis(), not on import
  // While disconnected, fail commands IMMEDIATELY instead of queueing them until Redis
  // returns. A cache lookup that waits seconds for Redis is worse than no cache at all.
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
  connectTimeout: 2_000,
  commandTimeout: 500, // a slow Redis must not make every request slow
  // Reconnecting itself is automatic (with backoff); no code needed for that.
});

let connected = false;
redis.on("ready", () => {
  if (!connected) logger.info("Redis ready");
  connected = true;
});
// ioredis emits "error" on every failed reconnect attempt: log only the first one of
// an outage, not one line every second. (An "error" event without a listener would
// also crash the process.)
redis.on("error", (err) => {
  if (connected) logger.warn({ err }, "Redis connection lost; running without cache");
  connected = false;
});

export async function connectRedis() {
  await redis.connect();
}

export function isRedisHealthy() {
  return redis.status === "ready";
}

export async function disconnectRedis() {
  await redis.quit();
  logger.info("Redis connection closed");
}
