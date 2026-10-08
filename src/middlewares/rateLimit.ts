import { NextFunction, Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
import { RedisReply, RedisStore } from "rate-limit-redis";
import { redis } from "../config/redis";
import { AppError } from "../utils/AppError";

export type RateLimitConfig = {
  windowMinutes: number;
  apiMax: number;
  authMax: number;
};

// Send 429 through our error handler so the response has the usual JSON shape.
// (The library has already set the RateLimit and Retry-After headers by now.)
function tooManyRequests(_req: Request, _res: Response, next: NextFunction) {
  next(new AppError(429, "Too many requests, please try again later"));
}

// Counters live in REDIS, shared by every app instance. With the default in-memory store,
// each instance behind the load balancer counted separately: 2 instances = 2x the limit,
// 10 instances = 10x. Now a client's requests count against ONE total wherever they land.
function redisStore(prefix: string) {
  return new RedisStore({
    sendCommand: (command: string, ...args: string[]) =>
      redis.call(command, ...args) as Promise<RedisReply>,
    prefix,
  });
}

export function createRateLimiters(config: RateLimitConfig) {
  const common = {
    windowMs: config.windowMinutes * 60 * 1000,
    standardHeaders: "draft-8" as const, // RateLimit-* headers tell clients their budget
    legacyHeaders: false,
    handler: tooManyRequests,
    // FAIL OPEN: if Redis is down, let requests through instead of rejecting everyone.
    // The trade-off: during a Redis outage there's no rate limiting. The alternative
    // (fail closed) would turn a Redis outage into a full API outage. For a login
    // limiter at a bank, you might choose differently.
    passOnStoreError: true,
  };

  return {
    // General abuse/scraping protection for the whole API.
    api: rateLimit({
      ...common,
      store: redisStore("rl:api:"),
      limit: config.apiMax,
      // Load balancers/Kubernetes probe health every few seconds: never block them.
      skip: (req) => req.path.startsWith("/health"),
    }),

    // Brute-force protection for login/register: a much smaller budget.
    // Only FAILED attempts count, so a real user logging in normally is never blocked,
    // while an attacker guessing passwords is stopped after a few tries.
    auth: rateLimit({
      ...common,
      store: redisStore("rl:auth:"),
      limit: config.authMax,
      skipSuccessfulRequests: true,
    }),
  };
}
