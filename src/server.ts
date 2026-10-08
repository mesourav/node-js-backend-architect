import { createApp } from "./app";
import { env } from "./config/env";
import { connectDB, disconnectDB } from "./config/db";
import { logger } from "./config/logger";

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

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, "Server started");
  });

  // Graceful shutdown: Docker/Kubernetes send SIGTERM before killing a container.
  // Stop accepting new requests, let in-flight ones finish, then close the DB.
  function shutdown(signal: string) {
    logger.info({ signal }, "Shutting down");
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
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
