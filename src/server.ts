import { createApp } from './app';
import { env } from './config/env';
import { connectDB, disconnectDB } from './config/db';

async function main() {
  // Connect to the DB BEFORE accepting traffic: no point serving requests we can't fulfil.
  await connectDB();

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    console.log(`Server running on http://localhost:${env.PORT} [${env.NODE_ENV}]`);
  });

  // Graceful shutdown: Docker/Kubernetes send SIGTERM before killing a container.
  // Stop accepting new requests, let in-flight ones finish, then close the DB.
  function shutdown(signal: string) {
    console.log(`${signal} received, shutting down...`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
