import { createApp } from "./app";
import { env } from "./config/env";
import { connectDB, disconnectDB } from "./config/db";
import { logger } from "./config/logger";
import { connectRedis, disconnectRedis } from "./config/redis";
import { markShuttingDown } from "./modules/health/health.service";

// Last-resort safety nets: after an unexpected error the process may be in a broken
// state, so log it and exit. Docker/Kubernetes will restart a fresh instance.
process.on("unhandledRejection", (reason) => {
  logger.fatal({ err: reason }, "Unhandled promise rejection");
  process.exit(1);
});
process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception");
  process.exit(1);
});

async function main() {
  // Connect to the DB BEFORE accepting traffic: no point serving requests we can't fulfil.
  await connectDB();
  // Redis must be reachable at STARTUP (the rate limiter loads its scripts into Redis
  // when the app is built). If it isn't, we exit and Docker/Kubernetes retry. Once
  // running, a Redis outage only degrades the app (see config/redis.ts).
  await connectRedis();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, "Server started");
  });

  // Timeouts for running behind a load balancer (AWS ALB idle timeout = 60s by default).
  // Node must keep idle connections open LONGER than the ALB does; otherwise Node closes
  // a connection just as the ALB reuses it, and the client gets a random 502.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000; // must be greater than keepAliveTimeout
  // A slow or stuck client can't hold a connection (and memory) forever.
  server.requestTimeout = 30_000;

  // Graceful shutdown: Docker/Kubernetes send SIGTERM before killing a container.
  // Fail readiness first (no new traffic), let in-flight requests finish, then close the DB.
  function shutdown(signal: string) {
    logger.info({ signal }, "Shutting down");
    markShuttingDown();
    // This callback runs outside any request, so Express can't catch its errors:
    // this is exactly where an explicit try/catch belongs.
    server.close(async () => {
      try {
        await Promise.all([disconnectDB(), disconnectRedis()]);
        process.exit(0);
      } catch (err) {
        logger.error({ err }, "Error while closing database connections");
        process.exit(1);
      }
    });
    setTimeout(() => {
      logger.error("Graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, 10_000).unref();
  }

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err: unknown) => {
  logger.fatal({ err }, "Failed to start server");
  process.exit(1);
});
