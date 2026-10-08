import { RedisContainer, StartedRedisContainer } from "@testcontainers/redis";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { TestProject } from "vitest/node";

// Real dependencies, started once for the whole test run:
//
// - MongoDB in memory, as a REPLICA SET (here a single member) because MongoDB only
//   supports transactions on replica sets, like Atlas always is.
// - Redis in a throwaway Docker container (Testcontainers). There's no reliable
//   in-memory Redis for Windows, and fakes don't run the Lua scripts the rate limiter
//   uses. Requires Docker Desktop to be running.
export async function setup(project: TestProject) {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });

  let redis: StartedRedisContainer;
  try {
    redis = await new RedisContainer("redis:8-alpine").start();
  } catch (err) {
    await replSet.stop();
    throw new Error(
      "Tests need Docker Desktop running (they start a Redis container). Start it and retry.",
      { cause: err },
    );
  }

  project.provide("mongoUri", replSet.getUri());
  project.provide("redisUrl", redis.getConnectionUrl());

  return async function teardown() {
    await Promise.all([replSet.stop(), redis.stop()]);
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
    redisUrl: string;
  }
}
