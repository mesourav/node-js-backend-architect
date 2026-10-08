import { logger } from "../config/logger";
import { redis } from "../config/redis";

// Cache helpers. Every function here FAILS OPEN: if Redis is down or slow, it reports
// "no cache" and the caller reads MongoDB instead. The cache can make the API faster;
// it must never make it fail.

export type CacheNamespace = "products" | "brands";

/**
 * NAMESPACE VERSIONING (how we invalidate many keys at once).
 *
 * GET /products has endless variations (?page=2, ?category=books&sort=-priceInCents...),
 * each cached under its own key. After a product changes, ALL of them are stale.
 * Deleting them one by one would need KEYS/SCAN over the whole keyspace (slow, and KEYS
 * blocks Redis). Instead every key embeds a version number:
 *
 *     cache:products:v7:/api/v1/products?page=2
 *
 * Invalidating = INCR the version (one O(1) command). New requests build v8 keys, miss,
 * and reload; the old v7 entries are never read again and simply expire via their TTL.
 */
function versionKey(namespace: CacheNamespace) {
  return `cache:${namespace}:version`;
}

export async function buildCacheKey(namespace: CacheNamespace, suffix: string) {
  try {
    const version = (await redis.get(versionKey(namespace))) ?? "0";
    return `cache:${namespace}:v${version}:${suffix}`;
  } catch {
    return null; // Redis unavailable -> caller skips the cache
  }
}

export async function readCache(key: string) {
  try {
    return await redis.get(key);
  } catch {
    return null;
  }
}

export async function writeCache(key: string, value: string, ttlSeconds: number) {
  // TTL JITTER: entries cached at the same moment would otherwise all expire at the same
  // moment, sending a burst of requests to MongoDB together. A little randomness
  // (here up to +10%) spreads the expiries out.
  const jitter = Math.floor(Math.random() * ttlSeconds * 0.1);
  try {
    await redis.set(key, value, "EX", ttlSeconds + jitter);
  } catch {
    // Not cached this time; the next request will try again.
  }
}

// Call AFTER the database change has committed (see product/brand services).
export async function invalidateCache(...namespaces: CacheNamespace[]) {
  try {
    await Promise.all(namespaces.map((ns) => redis.incr(versionKey(ns))));
  } catch (err) {
    // We couldn't invalidate. Clients may see stale data until the TTL expires, which
    // is exactly why every cache entry has a TTL: it bounds how stale data can get.
    logger.warn({ err, namespaces }, "Cache invalidation failed");
  }
}
