import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, inject } from "vitest";

// --- Redis: connect BEFORE the test file is loaded ---
// Test files build the app when they're imported (`createApp()`), and the rate limiter
// loads its scripts into Redis right then, so Redis must already be connected.
// Setup files run before each test file, so we connect here at the top level.
//
// Parallel test files run in separate worker processes. Each worker uses its own Redis
// database number (Redis has 16), so one file's cache entries or rate-limit counters
// can't leak into another's. The env var must be set before src/config is imported,
// hence the dynamic import below.
//
// (This file is .mts, an ES module, because only ES modules allow top-level `await`.
// ES modules need the ".js" extension in relative imports; Vitest maps it to the .ts file.)
const workerId = Number(process.env.VITEST_POOL_ID ?? "1");
process.env.REDIS_URL = `${inject("redisUrl")}/${workerId % 16}`;
const { redis, connectRedis } = await import("../src/config/redis.js");
await connectRedis();

beforeAll(async () => {
  // Test files run in parallel, so each gets its own database: no interference.
  await mongoose.connect(inject("mongoUri"), { dbName: `test-${randomUUID()}` });
  // Wait until every model's indexes exist. Otherwise a "duplicate email -> 409" test
  // could run before the unique index is built and wrongly pass the insert.
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
});

// Every test starts from an empty database AND an empty Redis (no cached responses,
// no rate-limit counters): tests must never depend on each other.
afterEach(async () => {
  await Promise.all([
    ...Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})),
    redis.flushdb(),
  ]);
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await redis.quit();
});
