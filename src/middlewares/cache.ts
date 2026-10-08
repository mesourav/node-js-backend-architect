import { NextFunction, Request, Response } from "express";
import { CacheNamespace, buildCacheKey, readCache, writeCache } from "../utils/cache";

/**
 * CACHE-ASIDE for public GET endpoints, at the HTTP layer:
 *   1. look in Redis              -> HIT: send the stored JSON, MongoDB isn't touched
 *   2. MISS: run the controller   -> store its 200 response in Redis for next time
 *
 * Caching the final JSON (rather than inside services) means the cached response is
 * byte-for-byte what the controller would send.
 *
 * Only for responses that are the SAME FOR EVERY USER. Never cache per-user or private
 * data (orders, /auth/me) in a shared cache: one user would get another user's data.
 *
 * The X-Cache header (HIT / MISS / BYPASS) shows what happened, handy when debugging.
 */
export function cacheResponse(namespace: CacheNamespace, ttlSeconds: number) {
  return async function cacheMiddleware(req: Request, res: Response, next: NextFunction) {
    const key = await buildCacheKey(namespace, req.originalUrl);
    if (!key) {
      res.setHeader("X-Cache", "BYPASS"); // Redis unavailable: serve from MongoDB
      return next();
    }

    const cached = await readCache(key);
    if (cached !== null) {
      res.setHeader("X-Cache", "HIT");
      res.type("application/json").send(cached);
      return;
    }

    res.setHeader("X-Cache", "MISS");
    // Wrap res.json so we can store the body the controller sends.
    const sendJson = res.json.bind(res);
    res.json = function storeAndSend(body: unknown) {
      if (res.statusCode === 200) {
        void writeCache(key, JSON.stringify(body), ttlSeconds); // don't delay the response
      }
      return sendJson(body);
    };
    next();
  };
}
