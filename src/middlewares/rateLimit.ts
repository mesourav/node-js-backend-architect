import { NextFunction, Request, Response } from "express";
import { rateLimit } from "express-rate-limit";
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

// NOTE: the default store keeps counters in this process's memory. With 3 instances
// behind a load balancer, each one counts separately (3x the limit). In Phase 8 we
// move the counters to Redis so all instances share them.
export function createRateLimiters(config: RateLimitConfig) {
  const common = {
    windowMs: config.windowMinutes * 60 * 1000,
    standardHeaders: "draft-8" as const, // RateLimit-* headers tell clients their budget
    legacyHeaders: false,
    handler: tooManyRequests,
  };

  return {
    // General abuse/scraping protection for the whole API.
    api: rateLimit({
      ...common,
      limit: config.apiMax,
      // Load balancers/Kubernetes probe health every few seconds: never block them.
      skip: (req) => req.path.startsWith("/health"),
    }),

    // Brute-force protection for login/register: a much smaller budget.
    // Only FAILED attempts count, so a real user logging in normally is never blocked,
    // while an attacker guessing passwords is stopped after a few tries.
    auth: rateLimit({
      ...common,
      limit: config.authMax,
      skipSuccessfulRequests: true,
    }),
  };
}
