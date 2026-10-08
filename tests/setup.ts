import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { afterAll, afterEach, beforeAll, inject } from "vitest";

beforeAll(async () => {
  // Test files run in parallel, so each gets its own database: no interference.
  await mongoose.connect(inject("mongoUri"), { dbName: `test-${randomUUID()}` });
  // Wait until every model's indexes exist. Otherwise a "duplicate email -> 409" test
  // could run before the unique index is built and wrongly pass the insert.
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
});

// Every test starts from an empty database: tests must never depend on each other.
afterEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
