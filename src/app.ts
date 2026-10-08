import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import apiRoutes from "./routes";
import { env } from "./config/env";
import { errorHandler, notFound } from "./middlewares/errorHandler";
import { createRateLimiters, RateLimitConfig } from "./middlewares/rateLimit";
import { requestLogger } from "./middlewares/requestLogger";

export type AppOptions = {
  // Lets tests use tiny limits without changing the environment.
  rateLimit?: Partial<RateLimitConfig>;
};

// app.ts builds the Express app but does NOT start listening.
// This lets tests import the app without opening a real port.
export function createApp(options: AppOptions = {}) {
  const app = express();

  // Behind a load balancer every request comes FROM the load balancer. Trusting N proxy
  // hops makes req.ip the real client IP; rate limiting per IP depends on it.
  // Never trust more hops than you actually have, or clients can fake their IP.
  app.set("trust proxy", env.TRUST_PROXY);

  const limiters = createRateLimiters({
    windowMinutes: env.RATE_LIMIT_WINDOW_MINUTES,
    apiMax: env.RATE_LIMIT_MAX,
    authMax: env.AUTH_RATE_LIMIT_MAX,
    ...options.rateLimit,
  });

  // Middleware order matters: each one runs top to bottom for every request.
  // 1. Log first, so even rejected requests (CORS, rate limit, bad JSON) get a log line + id.
  app.use(requestLogger);
  // 2. Security headers on every response (see the explanation in the Phase 5 notes).
  app.use(helmet());
  // 3. Which browser origins may call us. credentials: true allows the refresh cookie.
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }));
  // 4. Rate limits BEFORE body parsing and DB work: rejecting abuse should be cheap.
  app.use("/api/v1/auth/login", limiters.auth);
  app.use("/api/v1/auth/register", limiters.auth);
  app.use("/api/v1", limiters.api);
  // 5. Parse bodies (size-limited) and cookies.
  app.use(express.json({ limit: "10kb" }));
  app.use(cookieParser()); // fills req.cookies (used for the refresh token)

  app.use("/api/v1", apiRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
