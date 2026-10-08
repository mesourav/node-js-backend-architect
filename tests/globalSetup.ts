import { MongoMemoryServer } from "mongodb-memory-server";
import type { TestProject } from "vitest/node";

// A real MongoDB server running in memory, started once for the whole test run.
// Real database = tests exercise real queries, indexes and aggregations (no fakes),
// while staying fast, isolated, and free of any external dependency.
export async function setup(project: TestProject) {
  const mongod = await MongoMemoryServer.create();
  project.provide("mongoUri", mongod.getUri());

  return async function teardown() {
    await mongod.stop();
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}
