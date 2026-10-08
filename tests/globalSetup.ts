import { MongoMemoryReplSet } from "mongodb-memory-server";
import type { TestProject } from "vitest/node";

// A real MongoDB running in memory, started once for the whole test run.
// It's a REPLICA SET (here a single member) because MongoDB only supports transactions
// on replica sets, like Atlas always is. A standalone server would reject them.
export async function setup(project: TestProject) {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  project.provide("mongoUri", replSet.getUri());

  return async function teardown() {
    await replSet.stop();
  };
}

declare module "vitest" {
  export interface ProvidedContext {
    mongoUri: string;
  }
}
